import {parseContract, parseWireValue, WIRE_LIMITS, type Diagnostic, type Outcome, type PresentationPlan, type ResultRef, type VersionRef} from '@aeliqo/core';
import {sameCapabilityRef} from './registry.js';

export interface AgentRegisteredViewManifest {
  readonly ref: VersionRef;
  readonly configSchema: VersionRef;
  readonly roles: readonly string[];
  readonly result: 'required' | 'optional' | 'none';
  readonly children: {readonly min: number; readonly max: number};
  /** Trusted local config check. It never executes proposed code. */
  readonly validateConfig?: (values: Record<string, unknown>) => Outcome<unknown>;
}

export interface AgentCompositionRegistry {
  readonly views: readonly AgentRegisteredViewManifest[];
}

export interface ValidatedAgentComposition {
  readonly plan: PresentationPlan;
  readonly views: readonly AgentRegisteredViewManifest[];
  readonly resultReferences: readonly ResultRef[];
}

const fail = <T>(code: string, message: string, path?: readonly (string | number)[]): Outcome<T> => ({ok: false,
  diagnostics: [{code: `agent.composition.${code}`, message, retryable: false, ...(path === undefined ? {} : {path: [...path]})}]});

function validId(input: unknown): input is string {
  return typeof input === 'string' && input.length > 0 && input.length <= WIRE_LIMITS.id && !/[\s\u0000-\u001f\u007f]/u.test(input);
}

function key(ref: VersionRef): string { return `${ref.id}@${ref.revision}`; }

const EXECUTABLE_KEYS = new Set(['code', 'css', 'html', 'javascript', 'jsx', 'sql', 'script', 'module', 'moduleUrl', 'remoteModule', 'sourceUrl']);
const AUTHORITY_KEYS = new Set(['actor', 'approved', 'approval', 'grants', 'principalKey', 'credentials', 'authorization']);

function forbiddenConfigValue(input: unknown): string | undefined {
  if (input === null || typeof input !== 'object') return undefined;
  if (Array.isArray(input)) {
    for (const item of input) { const hit = forbiddenConfigValue(item); if (hit !== undefined) return hit; }
    return undefined;
  }
  for (const [name, value] of Object.entries(input as Record<string, unknown>)) {
    if (EXECUTABLE_KEYS.has(name)) return name;
    if (AUTHORITY_KEYS.has(name)) return name;
    const hit = forbiddenConfigValue(value);
    if (hit !== undefined) return hit;
  }
  return undefined;
}

function graphChecks(plan: PresentationPlan, manifests: ReadonlyMap<string, AgentRegisteredViewManifest>): Outcome<readonly AgentRegisteredViewManifest[]> {
  const nodes = new Map<string, PresentationPlan['nodes'][number]>();
  for (const [index, node] of plan.nodes.entries()) {
    if (nodes.has(node.id)) return fail('duplicate-node', 'A composition node identifier must be unique.', ['nodes', index, 'id']);
    const manifest = manifests.get(key(node.representation));
    if (manifest === undefined) return fail('unknown-node', 'The composition references a view that is not registered.', ['nodes', index, 'representation']);
    if (!manifest.roles.includes(node.role)) return fail('role', 'The proposed view role is not registered for this representation.', ['nodes', index, 'role']);
    if (!sameCapabilityRef(node.config.schema, manifest.configSchema)) return fail('schema', 'The proposed view configuration schema is not registered.', ['nodes', index, 'config', 'schema']);
    const forbidden = forbiddenConfigValue(node.config.values);
    if (forbidden !== undefined) return fail('executable', 'View configuration cannot contain executable code or authority assertions.', ['nodes', index, 'config', 'values', forbidden]);
    if (node.children.length < manifest.children.min || node.children.length > manifest.children.max) return fail('children', 'The proposed child count exceeds the registered view capability.', ['nodes', index, 'children']);
    if (manifest.children.max === 0 && node.children.length !== 0) return fail('children', 'A leaf view cannot have children.', ['nodes', index, 'children']);
    if (manifest.result === 'required' && node.result === undefined) return fail('result', 'This registered view requires an exact result reference.', ['nodes', index, 'result']);
    if (manifest.result === 'none' && node.result !== undefined) return fail('result', 'This queryless registered view cannot claim a result reference.', ['nodes', index, 'result']);
    if (manifest.validateConfig !== undefined) {
      let checked: Outcome<unknown>;
      try { checked = manifest.validateConfig(node.config.values); } catch { return fail('config', 'The registered view configuration check failed safely.', ['nodes', index, 'config']); }
      if (!checked.ok) return checked;
      const wire = parseWireValue(checked.value);
      if (!wire.ok) return fail('config', 'The registered view configuration check returned non-wire data.', ['nodes', index, 'config']);
    }
    nodes.set(node.id, node);
  }
  if (!nodes.has(plan.rootId)) return fail('root', 'The composition root must name a registered node.', ['rootId']);
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const visit = (id: string): Outcome<void> => {
    if (visiting.has(id)) return fail('cycle', 'Composition children must form an acyclic graph.', ['nodes']);
    if (visited.has(id)) return {ok: true, value: undefined};
    const node = nodes.get(id);
    if (node === undefined) return fail('child', 'A composition child does not name a registered node.', ['nodes', id]);
    visiting.add(id);
    for (const child of node.children) {
      if (!nodes.has(child)) return fail('child', 'A composition child does not name a registered node.', ['nodes', id, 'children']);
      const result = visit(child);
      if (!result.ok) return result;
    }
    visiting.delete(id);
    visited.add(id);
    return {ok: true, value: undefined};
  };
  const rooted = visit(plan.rootId);
  if (!rooted.ok) return rooted;
  if (visited.size !== nodes.size) return fail('orphan', 'Every proposed view must be reachable from the composition root.');
  return {ok: true, value: [...nodes.values()].map((node) => manifests.get(key(node.representation))!).filter((manifest): manifest is AgentRegisteredViewManifest => manifest !== undefined)};
}

/** Validate a model-proposed registered view graph with the same bounded wire
 * and registry identity rules used by host presentation code. */
export function validateAgentComposition(
  input: unknown,
  registry: AgentCompositionRegistry,
): Outcome<ValidatedAgentComposition> {
  const wire = parseWireValue(input);
  if (!wire.ok) return fail('wire', 'The composition proposal is not bounded wire data.');
  if (wire.value !== null && typeof wire.value === 'object' && !Array.isArray(wire.value)
    && Object.keys(wire.value as Record<string, unknown>).some((name) => AUTHORITY_KEYS.has(name) || EXECUTABLE_KEYS.has(name)))
    return fail('authority', 'A composition proposal cannot carry actor, approval or executable module fields.');
  if (registry === null || typeof registry !== 'object' || !Array.isArray(registry.views) || registry.views.length === 0 || registry.views.length > WIRE_LIMITS.presentationNodes) return fail('registry', 'A bounded nonempty registered view set is required.');
  const plan = parseContract('presentation-plan', wire.value);
  if (!plan.ok) return plan;
  const manifests = new Map<string, AgentRegisteredViewManifest>();
  for (const [index, manifest] of registry.views.entries()) {
    if (manifest === null || typeof manifest !== 'object' || !validId(manifest.ref?.id) || !validId(manifest.ref?.revision) || !validId(manifest.configSchema?.id) || !validId(manifest.configSchema?.revision)
      || !Array.isArray(manifest.roles) || manifest.roles.length === 0 || manifest.roles.some((role: unknown) => !validId(role))
      || !Number.isSafeInteger(manifest.children?.min) || !Number.isSafeInteger(manifest.children?.max) || manifest.children.min < 0 || manifest.children.max < manifest.children.min || manifest.children.max > WIRE_LIMITS.presentationNodes)
      return fail('registry', 'A registered view manifest is malformed.', ['registry', index]);
    const metadata = {ref: manifest.ref, configSchema: manifest.configSchema, roles: manifest.roles, result: manifest.result, children: manifest.children};
    const checked = parseWireValue(metadata);
    if (!checked.ok || manifests.has(key(manifest.ref))) return fail('registry', 'Registered view identities must be unique and bounded.', ['registry', index]);
    manifests.set(key(manifest.ref), manifest);
  }
  const checkedGraph = graphChecks(plan.value, manifests);
  if (!checkedGraph.ok) return checkedGraph;
  const refs: ResultRef[] = [];
  for (const node of plan.value.nodes) if (node.result !== undefined && !refs.some((ref) => ref.id === node.result!.id && ref.revision === node.result!.revision && ref.outputId === node.result!.outputId && ref.queryDigest === node.result!.queryDigest && ref.scopeDigest === node.result!.scopeDigest)) refs.push(node.result);
  return {ok: true, value: Object.freeze({plan: plan.value, views: Object.freeze([...checkedGraph.value]), resultReferences: Object.freeze(refs)})};
}

export function createAgentCompositionRegistry(views: readonly AgentRegisteredViewManifest[]): Outcome<AgentCompositionRegistry> {
  if (!Array.isArray(views) || views.length === 0 || views.length > WIRE_LIMITS.presentationNodes) return fail('registry', 'A bounded nonempty registered view set is required.');
  const seen = new Set<string>();
  for (const view of views) {
    if (!validId(view.ref?.id) || !validId(view.ref?.revision) || seen.has(key(view.ref))) return fail('registry', 'Registered view identities must be valid and unique.');
    seen.add(key(view.ref));
  }
  return {ok: true, value: Object.freeze({views: Object.freeze([...views])})};
}

export type AgentCompositionDiagnostic = Diagnostic;
