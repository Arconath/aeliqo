import {parseContract, validateInteractionGraph, INTERACTION_GRAPH_LIMITS} from '@aeliqo/core';
import type {
  InteractionEvent,
  InteractionFailure,
  InteractionGraph,
  InteractionGraphDefinition,
  InteractionGraphOptions,
  InteractionLink,
  InteractionMappingRegistration,
  InteractionMappingContext,
  InteractionOutcome,
  InteractionPayload,
  InteractionPort,
  InteractionPortShape,
  InteractionRoute,
  InteractionRoutedPayload,
} from './types.js';

const DEFAULT_MAX_HOPS = 32;
const DEFAULT_MAX_ROUTES = 256;
const failure = <T>(code: InteractionFailure['code'], message: string): InteractionOutcome<T> =>
  ({ok: false, diagnostics: [{code, message, retryable: false}]});
const refKey = (ref: {readonly id: string; readonly revision: string}): string => JSON.stringify([ref.id, ref.revision]);
const routeKey = (route: InteractionRoute): string => `${route.nodeId}\u0000${route.portId}`;

function canonical(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'undefined';
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${canonical(record[key])}`).join(',')}}`;
}

function shapeKey(shape: InteractionPortShape): string {
  const type = shape.type === undefined ? undefined : {...shape.type, ...(shape.type.grain === undefined ? {} : {grain: [...shape.type.grain].sort()})};
  return canonical({payload: shape.payload, ...(shape.entity === undefined ? {} : {entity: shape.entity}),
    ...(shape.identity === undefined ? {} : {identity: shape.identity}), ...(shape.grain === undefined ? {} : {grain: [...shape.grain].sort()}),
    ...(type === undefined ? {} : {type}), ...(shape.extension === undefined ? {} : {extension: shape.extension})});
}

function portMap(definition: InteractionGraphDefinition): Map<string, InteractionPort> {
  const ports = new Map<string, InteractionPort>();
  for (const node of definition.nodes) for (const port of node.ports) ports.set(`${node.id}\u0000${port.id}`, port);
  return ports;
}

function endpoint(link: InteractionLink, side: 'source' | 'target'): InteractionRoute {
  return side === 'source' ? {nodeId: link.source.node, portId: link.source.port} : {nodeId: link.target.node, portId: link.target.port};
}

function validDefinition(input: InteractionGraphDefinition): InteractionOutcome<InteractionGraphDefinition> {
  const checked = validateInteractionGraph({nodes: input.nodes, links: input.links}, input.mappings);
  if (!checked.ok) return failure('runtime.interaction-invalid', checked.diagnostics[0]!.message);
  return {ok: true, value: checked.value};
}

class InteractionGraphImpl implements InteractionGraph {
  readonly definition: InteractionGraphDefinition;
  private readonly mappings = new Map<string, InteractionMappingRegistration>();
  private readonly bySource = new Map<string, readonly InteractionLink[]>();
  private readonly maxHops: number;
  private readonly maxRoutes: number;
  private disposed = false;

  constructor(definition: InteractionGraphDefinition, options: InteractionGraphOptions = {}) {
    const checked = validDefinition(definition);
    if (!checked.ok) throw new TypeError(checked.diagnostics[0]!.message);
    this.definition = checked.value;
    this.maxHops = options.maxHops ?? DEFAULT_MAX_HOPS;
    this.maxRoutes = options.maxRoutes ?? DEFAULT_MAX_ROUTES;
    if (!Number.isSafeInteger(this.maxHops) || this.maxHops < 1 || this.maxHops > INTERACTION_GRAPH_LIMITS.links) throw new TypeError('maxHops must be a bounded positive integer.');
    if (!Number.isSafeInteger(this.maxRoutes) || this.maxRoutes < 1 || this.maxRoutes > INTERACTION_GRAPH_LIMITS.links) throw new TypeError('maxRoutes must be a bounded positive integer.');
    const grouped = new Map<string, InteractionLink[]>();
    for (const link of this.definition.links) {
      const key = routeKey(endpoint(link, 'source'));
      const links = grouped.get(key) ?? [];
      links.push(link);
      grouped.set(key, links);
      if (link.propagation === 'identity-equivalence') {
        const reverse = {...link, source: link.target, target: link.source};
        const reverseKey = routeKey(endpoint(reverse, 'source'));
        const reverseLinks = grouped.get(reverseKey) ?? [];
        reverseLinks.push(reverse);
        grouped.set(reverseKey, reverseLinks);
      }
    }
    for (const [key, links] of grouped) this.bySource.set(key, Object.freeze([...links]));
  }

  registerMapping(mapping: InteractionMappingRegistration): InteractionOutcome<void> {
    if (this.disposed) return failure('runtime.interaction-disposed', 'The interaction graph has been disposed.');
    if (mapping === null || typeof mapping !== 'object') return failure('runtime.interaction-invalid', 'A mapping registration is required.');
    const key = refKey(mapping.manifest.ref);
    const declared = this.definition.mappings.find((candidate) => refKey(candidate.ref) === key);
    if (declared === undefined || declared.kind !== mapping.manifest.kind || shapeKey(declared.source) !== shapeKey(mapping.manifest.source) || shapeKey(declared.target) !== shapeKey(mapping.manifest.target))
      return failure('runtime.interaction-invalid', 'A mapping callback does not match the trusted graph manifest.');
    if (declared.kind === 'registered' && typeof mapping.map !== 'function') return failure('runtime.interaction-invalid', 'Registered interaction mappings require a local callback.');
    if (declared.kind === 'identity' && mapping.map !== undefined) return failure('runtime.interaction-invalid', 'Identity mappings use built-in propagation and cannot install callbacks.');
    if (this.mappings.has(key)) return failure('runtime.interaction-invalid', 'An interaction mapping callback is already registered.');
    this.mappings.set(key, Object.freeze({...mapping}));
    return {ok: true, value: undefined};
  }

  route(event: InteractionEvent, source: InteractionRoute, signal: AbortSignal, maxHops = this.maxHops): InteractionOutcome<readonly InteractionRoutedPayload[]> {
    if (this.disposed) return failure('runtime.interaction-disposed', 'The interaction graph has been disposed.');
    if (!Number.isSafeInteger(maxHops) || maxHops < 1 || maxHops > this.maxHops) return failure('runtime.interaction-budget', 'The interaction propagation hop budget is invalid.');
    const ports = portMap(this.definition);
    const sourcePort = ports.get(routeKey(source));
    if (sourcePort === undefined || sourcePort.direction === 'input') return failure('runtime.interaction-invalid', 'The interaction source port is not a registered output.');
    if (sourcePort.payload !== event.payload.kind) return failure('runtime.interaction-invalid', 'The interaction payload does not match its source port.');
    const queue: Array<{readonly route: InteractionRoute; readonly payload: InteractionPayload; readonly hops: number}> = [{route: source, payload: event.payload, hops: 0}];
    const visited = new Set<string>();
    const routed: InteractionRoutedPayload[] = [];
    while (queue.length > 0) {
      if (signal.aborted) return failure('runtime.interaction-cancelled', 'The interaction was cancelled.');
      const current = queue.shift()!;
      // The source is at hop 0, so a one-edge route is valid with maxHops=1.
      // Reject only when attempting to expand a route beyond the limit.
      if (current.hops > maxHops) return failure('runtime.interaction-budget', 'The interaction propagation exceeded its bounded hop budget.');
      const links = this.bySource.get(routeKey(current.route)) ?? [];
      for (const link of links) {
        if (signal.aborted) return failure('runtime.interaction-cancelled', 'The interaction was cancelled.');
        const target = endpoint(link, 'target');
        const mapping = this.definition.mappings.find((candidate) => refKey(candidate.ref) === refKey(link.mapping));
        if (mapping === undefined) return failure('runtime.interaction-invalid', 'The interaction link references an unknown mapping.');
        let mapped: InteractionPayload;
        if (link.propagation === 'identity-equivalence') {
          if (current.payload.kind !== 'selection' || mapping.kind !== 'identity') return failure('runtime.interaction-invalid', 'Only identity selection mappings may propagate an equivalence cycle.');
          mapped = current.payload;
        } else {
          const registration = this.mappings.get(refKey(mapping.ref));
          if (registration?.map === undefined) return failure('runtime.interaction-invalid', 'A registered interaction mapping callback is unavailable.');
          const mappedResult = (() => {
            try {
              const context: InteractionMappingContext = {event, source: current.route, target, signal};
              return registration.map(current.payload, context);
            } catch {
              return failure<InteractionPayload>('runtime.interaction-invalid', 'A registered interaction mapping callback failed.');
            }
          })();
          if (!mappedResult.ok) return mappedResult;
          mapped = mappedResult.value;
        }
        const checked = parseContract('interaction', {...event, originNodeId: target.nodeId, payload: mapped});
        if (!checked.ok) return failure('runtime.interaction-invalid', 'A mapping callback returned a payload outside the canonical interaction contract.');
        const targetPort = ports.get(routeKey(target));
        if (targetPort === undefined || targetPort.direction === 'output' || targetPort.payload !== checked.value.payload.kind)
          return failure('runtime.interaction-invalid', 'A mapped payload does not match its target input port.');
        const visitKey = `${routeKey(target)}\u0000${canonical(checked.value.payload)}`;
        if (visited.has(visitKey)) continue;
        visited.add(visitKey);
        if (routed.length >= this.maxRoutes) return failure('runtime.interaction-budget', 'The interaction produced too many routed payloads.');
        const routedPayload = Object.freeze({route: target, payload: checked.value.payload, mapping: link.mapping, causationId: event.eventId});
        routed.push(routedPayload);
        queue.push({route: target, payload: checked.value.payload, hops: current.hops + 1});
      }
    }
    return {ok: true, value: Object.freeze(routed)};
  }

  dispose(): void { this.disposed = true; this.mappings.clear(); this.bySource.clear(); }
}

export function createInteractionGraph(input: InteractionGraphDefinition, options?: InteractionGraphOptions): InteractionGraph {
  return new InteractionGraphImpl(input, options);
}
