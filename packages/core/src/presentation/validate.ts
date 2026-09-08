import * as z from 'zod/mini';
import {parseContract, parseResult} from '../contracts/parse.js';
import {inspectWire} from '../contracts/ingress.js';
import {idSchema, jsonSchema} from '../contracts/schemas.js';
import {WIRE_LIMITS} from '../contracts/limits.js';
import {validateCommitReadSet} from '../contracts/commit.js';
import {validateTaskStructure} from '../contracts/task/index.js';
import {resolveExperienceConstraints} from '../contracts/experience/index.js';
import {validateInteractionGraph} from '../interaction/graph.js';
import type {Outcome, Result, ResultRef} from '../contracts/types.js';
import type {PresentationContext, PresentationRegistry, PresentationValues, ResolvedPresentationNode, ValidatedPresentation} from './types.js';
import {freezePresentation, presentationFailure as fail, versionKey} from './registry.js';

const refKey = (r: ResultRef): string => JSON.stringify([r.id, r.revision, r.outputId, r.queryDigest, r.scopeDigest]);
const resolvedSchema = z.strictObject({values: z.record(z.string(), jsonSchema),
  fields: z.array(idSchema).check(z.maxLength(WIRE_LIMITS.array)), ports: z.array(z.unknown()).check(z.maxLength(128))});

/** Validate feasibility against trusted descriptors/registry. This grants no runtime effects. */
export function validatePresentationPlan(
  input: unknown, context: PresentationContext, registry: PresentationRegistry,
): Outcome<ValidatedPresentation> {
  const parsed = parseContract('presentation-plan', input);
  if (!parsed.ok) return parsed;
  const plan = freezePresentation(parsed.value);
  const constraints = resolveExperienceConstraints(context.experience, context.task, context.restrictions);
  if (!constraints.ok) return constraints;
  const c = constraints.value;
  if (!c.allowWithoutPreset) return fail('pattern-required', 'This validator currently requires a profile allowing registered views without a preset.');
  const task = validateTaskStructure(c.task);
  if (!task.ok) return task;
  const environment = parseContract('environment', context.environment);
  if (!environment.ok) return environment;
  if (c.task.revision !== context.current.taskRevision || c.task.catalogRevision !== context.current.catalogRevision
    || c.task.functionRegistryDigest !== context.current.functionRegistryDigest || c.experience.revision !== context.current.experienceRevision)
    return fail('stale', 'The task or experience differs from the current version pins.');
  if (plan.nodes.length === 0 || plan.nodes.length > c.maxNodes) return fail('nodes', 'The candidate exceeds the permitted node count.');
  if (!Array.isArray(context.results) || context.results.length > WIRE_LIMITS.outputs)
    return fail('results', 'The authorized result descriptors must be bounded.');
  const results = new Map<string, Result>();
  for (const inputResult of context.results) {
    const result = parseResult(inputResult);
    if (!result.ok) return result;
    const key = refKey(result.value.ref);
    if (results.has(key)) return fail('results', 'The descriptor list repeats a result reference.');
    results.set(key, freezePresentation(result.value));
  }
  const readSet = validateCommitReadSet(plan.preconditions, context.current,
    [...task.value.resultReferences, ...plan.nodes.flatMap(n => n.result === undefined ? [] : [n.result])]);
  if (!readSet.ok) return readSet;
  const nodes = new Map(plan.nodes.map(node => [node.id, node]));
  if (nodes.size !== plan.nodes.length || !nodes.has(plan.rootId)) return fail('tree', 'Node IDs must be unique and the root must exist.');
  const parents = new Map<string, string>();
  for (const node of plan.nodes) {
    for (const child of node.children) {
      if (!nodes.has(child) || child === plan.rootId || parents.has(child)) return fail('tree', 'Rendered nodes must form one tree with unique parent ownership.');
      parents.set(child, node.id);
    }
  }
  const visit = [plan.rootId];
  const visited = new Set<string>();
  for (let i = 0; i < visit.length; i++) {
    const id = visit[i]!;
    if (visited.has(id)) return fail('tree', 'Containment cycles are not allowed.');
    visited.add(id); visit.push(...nodes.get(id)!.children);
  }
  if (visited.size !== nodes.size) return fail('tree', 'All nodes must be reachable from the declared root.');
  const manifests = new Map(registry.manifests.map(m => [versionKey(m.ref), m]));
  const renderer = new Set(context.rendererCapabilities.map(versionKey));
  const extensions = new Set(c.extensionAllowlist.map(versionKey));
  const resolved: ResolvedPresentationNode[] = [];
  for (const node of plan.nodes) {
    const key = versionKey(node.representation);
    const m = manifests.get(key);
    if (m === undefined || !renderer.has(key)) return fail('renderer', 'The requested representation is unavailable on this renderer.');
    if (!c.allowedRepresentations.includes(m.ref.id) || (m.extension && !extensions.has(key))) return fail('restricted', 'The experience does not allow this representation.');
    if (!m.roles.includes(node.role) || versionKey(node.config.schema) !== versionKey(m.configSchema)) return fail('configuration', 'The representation role or configuration schema does not match its registration.');
    if (node.children.length < m.children.min || node.children.length > m.children.max) return fail('children', 'The child count violates the representation contract.');
    const result = node.result === undefined ? undefined : results.get(refKey(node.result));
    if ((node.result !== undefined && result === undefined) || (m.result === 'required' && result === undefined) || (m.result === 'none' && result !== undefined))
      return fail('binding', 'The representation requires an available, compatible result binding.');
    if (result !== undefined) {
      if (c.task.kind === 'presentation' && !c.task.inputs.some(ref => refKey(ref) === refKey(result.ref)))
        return fail('binding', 'The result is not one of the queryless task inputs.');
      if (c.task.kind === 'data') {
        const output = c.task.outputs.find(output => output.id === result.ref.outputId);
        if (output === undefined || (output.kind === 'reuse' ? refKey(output.result) !== refKey(result.ref) : result.taskId !== c.task.id))
          return fail('binding', 'The result does not belong to the declared task output.');
      }
      if (c.task.kind === 'form') return fail('binding', 'Queryless forms do not implicitly consume result data.');
    }
    let output: unknown;
    try { output = m.resolveConfig(node.config.values, result); } catch { return fail('configuration', 'The registered configuration validator failed.'); }
    const wire = inspectWire(output);
    if (!wire.ok) return wire;
    const outcome = wire.value as {ok?: unknown; value?: unknown};
    if (outcome === null || typeof outcome !== 'object' || outcome.ok !== true) return fail('configuration', 'The configuration does not satisfy its registered semantic contract.');
    const config = z.safeParse(resolvedSchema, outcome.value);
    if (!config.success || new Set(config.data.fields).size !== config.data.fields.length) return fail('configuration', 'The registered configuration result is malformed.');
    if (config.data.fields.some(field => !result?.fields.some(f => f.id === field))) return fail('field', 'A representation refers to a field absent from its result.');
    const portGraph = validateInteractionGraph({nodes: [{id: node.id, ports: config.data.ports}], links: []}, []);
    if (!portGraph.ok) return portGraph;
    const values: PresentationValues = config.data.values;
    resolved.push({node: {...node, config: {schema: node.config.schema, values}}, manifest: m.ref,
      config: {values, fields: config.data.fields, ports: portGraph.value.nodes[0]!.ports}, result});
  }
  const byId = new Map(resolved.map(n => [n.node.id, n]));
  const coverage = new Map<string, typeof plan.coverage[number]>();
  const operations = new Set<string>();
  for (const entry of plan.coverage) {
    if (coverage.has(entry.needId) || new Set(entry.nodeIds).size !== entry.nodeIds.length || new Set(entry.operations.map(versionKey)).size !== entry.operations.length)
      return fail('coverage', 'Coverage entries must identify unique needs, nodes and operations.');
    const need = c.task.needs.find(n => n.id === entry.needId);
    if (need === undefined || !entry.operations.some(op => versionKey(op) === versionKey(need.operation))) return fail('coverage', 'Coverage must identify a declared task operation.');
    const fields = new Set<string>();
    for (const id of entry.nodeIds) {
      const n = byId.get(id);
      if (n === undefined) return fail('coverage', 'Coverage points to a missing node.');
      const m = manifests.get(versionKey(n.manifest))!;
      if (need.outputId !== undefined && n.result?.ref.outputId !== need.outputId) return fail('coverage', 'The operation is bound to a different task output.');
      if (!entry.operations.every(op => m.operations.some(supported => versionKey(supported) === versionKey(op)))) return fail('coverage', 'The representation does not support the claimed operation.');
      if (c.allowedOperations !== undefined && !entry.operations.every(op => c.allowedOperations!.some(allowed => versionKey(allowed) === versionKey(op)))) return fail('restricted', 'An operation is restricted by the active experience.');
      n.config.fields.forEach(field => fields.add(field));
    }
    if (need.fields.some(field => !fields.has(field))) return fail('coverage', 'The required fields are not supplied by the claimed views.');
    coverage.set(need.id, entry); entry.operations.forEach(op => operations.add(op.id));
  }
  if (c.task.needs.some(need => need.required && !coverage.has(need.id)) || c.requiredOperationIds.some(op => !operations.has(op)))
    return fail('coverage', 'The candidate omits a required operation.');
  // A field split or simultaneous-group comparison cannot cross exclusive sibling panels.
  const groups = new Map<string, Set<string>>();
  for (const need of c.task.needs) {
    const entry = coverage.get(need.id);
    if (entry === undefined) continue;
    const key = need.simultaneousGroup ?? `need:${need.id}`;
    const group = groups.get(key) ?? new Set<string>(); entry.nodeIds.forEach(id => group.add(id)); groups.set(key, group);
  }
  for (const group of groups.values()) {
    const branches = new Map<string, string>();
    for (const id of group) {
      let child = id;
      for (let parent = parents.get(child); parent !== undefined; parent = parents.get(child)) {
        const ancestor = byId.get(parent)!;
        if (manifests.get(versionKey(ancestor.manifest))!.visibility === 'exclusive') {
          if (branches.has(parent) && branches.get(parent) !== child) return fail('simultaneous', 'An exclusive container hides an essential comparison.');
          branches.set(parent, child);
        }
        child = parent;
      }
    }
  }
  if (context.incumbent !== undefined) {
    const old = parseContract('presentation-plan', context.incumbent);
    if (!old.ok) return old;
    const topology = (p: typeof plan) => JSON.stringify(p.nodes.map(n => [n.id, n.role, n.children]).sort((a, b) => String(a[0]).localeCompare(String(b[0]))));
    const variants = (p: typeof plan) => JSON.stringify(p.nodes.map(n => [n.id, versionKey(n.representation)]).sort());
    const structural = topology(old.value) !== topology(plan);
    const replacing = variants(old.value) !== variants(plan);
    const configurations = (p: typeof plan) => JSON.stringify(p.nodes.map(n => [n.id, n.config]).sort());
    const configurationChanged = configurations(old.value) !== configurations(plan);
    const semantics = (p: typeof plan) => JSON.stringify([p.links, p.coverage, p.nodes.map(n => [n.id, n.result]).sort()]);
    const semanticChanged = semantics(old.value) !== semantics(plan);
    if ((!c.compositionChangeAllowed && structural) || (!c.representationReplacementAllowed && replacing)) return fail('transition', 'The experience mode forbids this presentation change.');
    if ((structural || replacing || configurationChanged || semanticChanged) && (context.transitionBlocked === true || (c.transitionPolicy === 'explicit-only' && context.explicitTransition !== true)))
      return fail('transition', 'The presentation change must wait for the active interaction or an explicit user transition.');
    if (structural || replacing || configurationChanged || semanticChanged) {
      for (const previous of old.value.nodes) {
        if (!nodes.has(previous.id) || !plan.stateTransfer.some(t => t.fromNode === previous.id && t.toNode === previous.id))
          return fail('state-transfer', 'Changing a presentation requires an explicit transfer for every existing view identity.');
      }
    }
    const transferred = new Set<string>();
    for (const transfer of plan.stateTransfer) {
      if (transferred.has(transfer.fromNode)) return fail('state-transfer', 'A view identity cannot be transferred twice.');
      transferred.add(transfer.fromNode);
      const from = old.value.nodes.find(n => n.id === transfer.fromNode); const to = nodes.get(transfer.toNode);
      // T39 supports stable identity only. Other transitions need a registered transfer contract.
      if (from === undefined || to === undefined || from.id !== to.id || from.role !== to.role || versionKey(from.representation) !== versionKey(to.representation)
        || transfer.mapping.id !== 'aeliqo.state.identity' || transfer.mapping.revision !== '1') return fail('state-transfer', 'This state transfer has no supported identity-preserving contract.');
    }
  } else if (plan.stateTransfer.length) return fail('state-transfer', 'State transfer requires an existing presentation.');
  const graph = validateInteractionGraph({nodes: resolved.map(n => ({id: n.node.id, ports: n.config.ports})), links: plan.links}, registry.mappings);
  if (!graph.ok) return graph;
  return {ok: true, value: freezePresentation({plan: {...plan, nodes: resolved.map(n => n.node)}, nodes: resolved, graph: graph.value, environment: environment.value})};
}
