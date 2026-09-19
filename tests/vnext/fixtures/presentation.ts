import { createPresentationRegistry } from '../../../packages/core/src/presentation/index.js';
import type {
  PresentationContext,
  PresentationManifest,
  PresentationRegistry,
  PresentationResolverInput,
} from '../../../packages/core/src/presentation/index.js';
import type { PresentationPlan, VersionRef } from '../../../packages/core/src/contracts/types.js';
import { environment, experience, presentationPlan, presentationTask, result } from '../../contracts/fixtures.js';

export const read = { id: 'data.read', revision: '1' } as const;
export const tableRef = { id: 'data.table', revision: '1' } as const;
export const listRef = { id: 'data.list', revision: '1' } as const;
export const cardRef = { id: 'data.card-collection', revision: '1' } as const;

export function manifest(ref: VersionRef, quality = 0): PresentationManifest {
  return {
    ref,
    configSchema: { id: ref.id + '.config', revision: '1' },
    roles: ['browse'],
    operations: [read],
    result: 'required',
    children: { min: 0, max: 0 },
    visibility: 'leaf',
    extension: false,
    resolveConfig: (values, descriptor) =>
      descriptor === undefined
        ? { ok: false, diagnostics: [{ code: 'config.result', message: 'A result is required.', retryable: false }] }
        : { ok: true, value: { values, fields: descriptor.fields.map((field) => field.id), ports: [] } },
    assess: () => ({
      ok: true,
      value: { taskFit: quality, informationDensity: 0, interactionEffort: 0, legibilityPenalty: 0 },
    }),
  };
}

export function registry(
  entries: readonly PresentationManifest[] = [manifest(tableRef), manifest(listRef)],
): PresentationRegistry {
  const created = createPresentationRegistry(entries);
  if (!created.ok) throw new Error(JSON.stringify(created.diagnostics));
  return created.value;
}

export function candidate(id: string, ref: VersionRef = tableRef): PresentationResolverInput['candidates'][number] {
  const plan: PresentationPlan = {
    ...presentationPlan,
    rootId: id + '-node',
    nodes: [
      {
        id: id + '-node',
        role: 'browse',
        representation: ref,
        result: result.ref,
        config: { schema: { id: ref.id + '.config', revision: '1' }, values: {} },
        children: [],
      },
    ],
    coverage: [{ needId: 'browse', nodeIds: [id + '-node'], operations: [read] }],
  };
  return { id, source: 'explicit', plan };
}

export function context(): PresentationContext {
  return {
    task: {
      ...presentationTask,
      needs: [{ id: 'browse', operation: read, fields: ['employee.id'], outputId: 'rows', required: true }],
    },
    experience: {
      ...experience,
      mode: 'composable',
      allowedRepresentations: [tableRef.id, listRef.id],
      composition: { ...experience.composition, maxExpansions: 8 },
    },
    results: [result],
    current: presentationPlan.preconditions,
    environment: { ...environment },
    rendererCapabilities: [tableRef, listRef],
  };
}

export function fixture(overrides: Partial<PresentationResolverInput> = {}): PresentationResolverInput {
  return {
    id: 'resolver-request',
    revision: '1',
    preconditions: presentationPlan.preconditions,
    context: context(),
    registry: registry(),
    target: {
      address: {
        runtimeId: 'runtime',
        scopeInstanceId: 'scope',
        activationEpoch: 1,
        surfaceId: 'region-1',
        surfaceGeneration: 1,
      },
      state: 'active',
    },
    candidates: [candidate('table', tableRef), candidate('list', listRef)],
    ...overrides,
  };
}
