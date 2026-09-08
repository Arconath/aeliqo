import {beforeEach, describe, expect, it} from 'vitest';
import {
  createRegionStore,
  type RegionAuthority,
  type RegionHistoryEntry,
  type RegionContent,
  type RegionHandle,
} from '../../packages/runtime/src/regions/index.js';
import {createResultStore} from '../../packages/runtime/src/results/index.js';
import {parseRegionDocument, serializeRegionDocument} from '../../packages/runtime/src/persistence/index.js';

const task = (revision = '1', regionId = 'region-1'): RegionContent['task'] => ({
  version: '1', id: 'task-1', revision, catalogRevision: 'catalog-1', functionRegistryDigest: 'functions-1',
  regionId, goal: 'Show the rows', kind: 'presentation', needs: [], assumptions: [], inputs: [],
});
type TestResultRef = {readonly id: string; readonly revision: string; readonly outputId: string; readonly queryDigest: string; readonly scopeDigest: string};
const refA = {id: 'result-a', revision: 'result-1', outputId: 'rows', queryDigest: 'query-1', scopeDigest: 'scope-1'} as const;
const refB = {id: 'result-b', revision: 'result-1', outputId: 'trend', queryDigest: 'query-2', scopeDigest: 'scope-1'} as const;
const resultField = {id: 'id', label: 'ID', type: {value: 'text' as const, nullable: false}, role: 'identity' as const};
const resultDescriptor = {
  version: '1' as const, ref: refA, taskId: 'task-1', fields: [resultField], identity: ['id'], rowGrain: ['id'],
  counts: {loaded: 1, population: {kind: 'exact' as const, value: 1, populationDigest: 'population-1'}},
  precision: {kind: 'exact' as const}, coverage: {kind: 'complete' as const, populationDigest: 'population-1'},
  consistency: {kind: 'snapshot' as const, snapshotId: 'snapshot-1', sourceRevisions: {source: 'source-1'}},
  evidence: {kind: 'observed' as const, source: {id: 'source', revision: 'source-1'}}, filters: [], warnings: [], lineage: [],
} as const;
const resultKey = {principalKey: 'principal-a', scopeDigest: 'scope-1', policyRevision: 'policy-1', queryDigest: 'query-1', catalogRevision: 'catalog-1', functionRegistryDigest: 'functions-1', sourceRevision: 'source-1', outputId: 'rows', taskId: 'task-1', requestId: 'result-request', populationDigest: 'population-1'} as const;
const resultDescriptorB = {...resultDescriptor, ref: refB, consistency: {...resultDescriptor.consistency, sourceRevisions: {source: 'source-2'}}, evidence: {...resultDescriptor.evidence, source: {id: 'source', revision: 'source-2'}}} as const;
const resultKeyB = {...resultKey, queryDigest: 'query-2', outputId: 'trend', sourceRevision: 'source-2', requestId: 'result-request-b'} as const;
let authority: RegionAuthority = {
  principalKey: 'principal-a', scopeDigest: 'scope-1', policyRevision: 'policy-1', catalogRevision: 'catalog-1',
  experienceRevision: 'experience-1', functionRegistryDigest: 'functions-1', results: [refA, refB],
};
const options = (overrides: Partial<Parameters<typeof createRegionStore>[0]> = {}) => ({
  readAuthority: () => ({ok: true as const, value: authority}),
  authorizeCommit: async () => ({ok: true as const, value: undefined}),
  restoreRegion: async ({document}: {readonly document: {readonly task: RegionContent['task']}}) => ({ok: true as const, value: {state: {task: document.task}}}),
  ...overrides,
});
const create = (overrides: Partial<Parameters<typeof createRegionStore>[0]> = {}) => {
  const store = createRegionStore(options(overrides));
  const created = store.create({id: 'region-1', state: {task: task()}});
  if (!created.ok) throw new Error(created.diagnostics[0]!.message);
  return {store, region: created.value};
};

async function* resultEvents(): AsyncGenerator<unknown> {
  yield {kind: 'descriptor', descriptor: resultDescriptor};
  yield {kind: 'batch', result: refA, sequence: 0, rows: [{id: 'row-1'}]};
  yield {kind: 'complete', result: refA, finalCoverage: resultDescriptor.coverage};
}

async function* resultEventsFor<T extends {readonly ref: TestResultRef; readonly coverage: unknown}>(ref: TestResultRef, descriptor: T): AsyncGenerator<unknown> {
  yield {kind: 'descriptor', descriptor};
  yield {kind: 'batch', result: ref, sequence: 0, rows: [{id: 'row-1'}]};
  yield {kind: 'complete', result: ref, finalCoverage: descriptor.coverage};
}

beforeEach(() => {
  authority = {
    principalKey: 'principal-a', scopeDigest: 'scope-1', policyRevision: 'policy-1', catalogRevision: 'catalog-1',
    experienceRevision: 'experience-1', functionRegistryDigest: 'functions-1', results: [refA, refB],
  };
});

describe('transactional region store', () => {
  it('stages an opaque token, commits atomically and owns task/region revisions', async () => {
    const {region} = create();
    const initialRegionRevision = region.snapshot().regionRevision;
    const observed: string[] = [];
    region.observe((update) => observed.push(`${update.kind}:${update.snapshot.regionRevision}`));
    const staged = await region.stage({requestId: 'request-1', expected: region.snapshot().readSet!, state: {task: task()}});
    expect(staged.ok).toBe(true);
    if (!staged.ok) return;
    const result = await region.commit(staged.value);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.regionRevision).not.toBe(initialRegionRevision);
    expect(result.value.taskRevision).toBe('2');
    expect(result.value.dataRevision).toBe(0);
    expect(result.value.state?.task.revision).toBe('2');
    expect(observed).toEqual([`commit:${result.value.regionRevision}`]);
    expect(region.history()).toHaveLength(2);
    expect(region.history()[1]?.taskRevision).toBe('2');
    expect(Object.isFrozen(result.value)).toBe(true);
    expect(Object.isFrozen(result.value.state)).toBe(true);
    expect(Object.keys(region.history()[0]!)).not.toContain('state');
  });

  it('checks host scope/policy/catalog/profile and the complete dependency read set', async () => {
    const {region} = create();
    const expected = region.snapshot().readSet!;
    const changed = {...expected, scopeDigest: 'other-scope', results: []};
    const staged = await region.stage({requestId: 'request-1', expected: changed, state: {task: task()}});
    expect(staged.ok).toBe(false);
    if (!staged.ok) expect(staged.diagnostics[0]?.code).toBe('runtime.region-stale');
    const missing = {...expected, results: [refA]};
    const stagedMissing = await region.stage({requestId: 'request-2', expected: missing, state: {task: task()}});
    expect(stagedMissing.ok).toBe(true); // unrelated current result may be absent from a smaller declared read set
    if (stagedMissing.ok) {
      authority = {...authority, results: [refA]};
      await expect(region.commit(stagedMissing.value)).resolves.toMatchObject({ok: true});
    }
    authority = {...authority, policyRevision: 'policy-2'};
    const stale = await region.stage({requestId: 'request-3', expected, state: {task: task()}});
    expect(stale.ok).toBe(false);
    if (!stale.ok) expect(stale.diagnostics[0]?.code).toBe('runtime.region-stale');
  });

  it('serializes A/B tokens so the second stale token cannot overwrite A', async () => {
    const {region} = create();
    const expected = region.snapshot().readSet!;
    const a = await region.stage({requestId: 'a', expected, state: {task: task()}});
    const b = await region.stage({requestId: 'b', expected, state: {task: task()}});
    expect(a.ok && b.ok).toBe(true);
    if (!a.ok || !b.ok) return;
    await expect(region.commit(a.value)).resolves.toMatchObject({ok: true, value: {taskRevision: '2'}});
    await expect(region.commit(b.value)).resolves.toMatchObject({ok: false, diagnostics: [{code: 'runtime.region-stale'}]});
    expect(region.snapshot().state?.task.revision).toBe('2');
  });

  it('increments data revision, refreshes authority refs and targets logical output observers', async () => {
    const {region} = create();
    const events: string[] = [];
    region.observe((update) => events.push(`all:${update.kind}:${update.snapshot.dataRevision}`));
    region.observe((update) => events.push(`rows:${update.kind}:${update.snapshot.dataRevision}`), {results: [refA]});
    region.observe((update) => events.push(`trend:${update.kind}:${update.snapshot.dataRevision}`), {results: [refB]});
    authority = {...authority, results: [{...refA, revision: 'result-2'}, refB]};
    const update = await region.publishData({results: [{...refA, revision: 'result-2'}]});
    expect(update.ok).toBe(true);
    expect(update.ok && update.value.dataRevision).toBe(1);
    expect(update.ok && update.value.readSet?.results).toContainEqual({...refA, revision: 'result-2'});
    expect(events).toEqual(['all:data:1', 'rows:data:1']);
    expect(region.snapshot().state).toEqual({task: task()});
    const noop = await region.publishData({results: []});
    expect(noop.ok && noop.value.dataRevision).toBe(1);
  });

  it('rejects an explicit empty publication after the authority result set changes', async () => {
    const {region} = create();
    authority = {...authority, results: [{...refA, revision: 'result-2'}, refB]};
    await expect(region.publishData({results: []})).resolves.toMatchObject({ok: false, diagnostics: [{code: 'runtime.region-stale'}]});
  });

  it('broadcasts an unspecified publication and reports all authority output drift', async () => {
    const {region} = create();
    const events: string[] = [];
    region.observe(() => events.push('all'));
    region.observe(() => events.push('rows'), {results: [refA]});
    region.observe(() => events.push('trend'), {results: [refB]});
    await expect(region.publishData()).resolves.toMatchObject({ok: true, value: {dataRevision: 1}});
    expect(events).toEqual(['all', 'rows', 'trend']);
    events.length = 0;
    authority = {...authority, results: [{...refA, revision: 'result-2'}, {...refB, revision: 'result-2'}]};
    await expect(region.publishData({results: [{...refA, revision: 'result-2'}]})).resolves.toMatchObject({ok: true, value: {dataRevision: 2}});
    expect(events).toEqual(['all', 'rows', 'trend']);
  });

  it('allows a disjoint result refresh when the proposal read set omits that output', async () => {
    const {region} = create();
    const expected = {...region.snapshot().readSet!, results: [refA]};
    const staged = await region.stage({requestId: 'disjoint-refresh', expected, state: {task: task()}});
    expect(staged.ok).toBe(true);
    if (!staged.ok) return;
    authority = {...authority, results: [refA, {...refB, revision: 'result-2'}]};
    await expect(region.commit(staged.value)).resolves.toMatchObject({ok: true, value: {taskRevision: '2'}});
  });

  it('makes a staged token stale after a same-reference refresh', async () => {
    const {region} = create();
    const staged = await region.stage({requestId: 'request-1', expected: region.snapshot().readSet!, state: {task: task()}});
    expect(staged.ok).toBe(true);
    if (!staged.ok) return;
    await region.publishData({results: [refA]});
    await expect(region.commit(staged.value)).resolves.toMatchObject({ok: false, diagnostics: [{code: 'runtime.region-stale'}]});
  });

  it('rechecks principal authority after asynchronous authorization', async () => {
    let release: (() => void) | undefined;
    const {region} = create({authorizeCommit: () => new Promise((resolve) => {release = () => resolve({ok: true, value: undefined});})});
    const staged = await region.stage({requestId: 'request-1', expected: region.snapshot().readSet!, state: {task: task()}});
    expect(staged.ok).toBe(true);
    if (!staged.ok) return;
    const pending = region.commit(staged.value);
    await Promise.resolve();
    authority = {...authority, principalKey: 'principal-b'};
    release?.();
    await expect(pending).resolves.toMatchObject({ok: false, diagnostics: [{code: 'runtime.region-stale'}]});
  });

  it('bounds stalled commit authorization, aborts its signal and advances the queue', async () => {
    let calls = 0;
    let stalledSignal: AbortSignal | undefined;
    const {region} = create({
      maxCommitAuthorizationMilliseconds: 5,
      authorizeCommit: ({signal}) => {
        calls++;
        if (calls === 1) { stalledSignal = signal; return new Promise(() => {}); }
        return {ok: true as const, value: undefined};
      },
    });
    const expected = region.snapshot().readSet!;
    const first = await region.stage({requestId: 'timeout-one', expected, state: {task: task()}});
    const second = await region.stage({requestId: 'timeout-two', expected, state: {task: task()}});
    expect(first.ok && second.ok).toBe(true);
    if (!first.ok || !second.ok) return;
    const pendingFirst = region.commit(first.value);
    const pendingSecond = region.commit(second.value);
    await expect(pendingFirst).resolves.toMatchObject({ok: false, diagnostics: [{code: 'runtime.region-budget'}]});
    expect(stalledSignal?.aborted).toBe(true);
    await expect(pendingSecond).resolves.toMatchObject({ok: true, value: {taskRevision: '2'}});
    expect(region.snapshot().state?.task.revision).toBe('2');
  });

  it('settles pending authorization promptly on revoke and dispose', async () => {
    for (const action of ['revoke', 'dispose'] as const) {
      let signal: AbortSignal | undefined;
      const {store, region} = create({authorizeCommit: ({signal: callbackSignal}) => {
        signal = callbackSignal;
        return new Promise(() => {});
      }});
      const staged = await region.stage({requestId: `pending-${action}`, expected: region.snapshot().readSet!, state: {task: task()}});
      expect(staged.ok).toBe(true);
      if (!staged.ok) continue;
      const pending = region.commit(staged.value);
      await Promise.resolve();
      if (action === 'revoke') expect(store.revoke('region-1')).toBe(true);
      else region.dispose();
      await expect(Promise.race([pending, new Promise((_, reject) => setTimeout(() => reject(new Error('authorization did not cancel')), 100))])).resolves.toMatchObject({ok: false});
      expect(signal?.aborted).toBe(true);
      expect(region.snapshot().status).toBe(action === 'revoke' ? 'revoked' : 'disposed');
    }
  });

  it('does not resurrect a region when post-authorization authority reenters revoke', async () => {
    let reads = 0;
    let region: RegionHandle | undefined;
    const store = createRegionStore(options({readAuthority: () => {
      reads++;
      if (reads === 4) region?.revoke('authority callback');
      return {ok: true as const, value: authority};
    }}));
    const created = store.create({id: 'region-1', state: {task: task()}});
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    region = created.value;
    const staged = await region.stage({requestId: 'reentrant-after', expected: region.snapshot().readSet!, state: {task: task()}});
    expect(staged.ok).toBe(true);
    if (staged.ok) await expect(region.commit(staged.value)).resolves.toMatchObject({ok: false, diagnostics: [{code: 'runtime.region-revoked'}]});
    expect(region.snapshot().status).toBe('revoked');
    expect(region.snapshot().state).toBeUndefined();
  });

  it('does not publish data when authority reenters revoke', async () => {
    let region: RegionHandle | undefined;
    let firstRead = true;
    const store = createRegionStore(options({readAuthority: () => {
      if (!firstRead) region?.revoke('authority callback');
      firstRead = false;
      return {ok: true as const, value: authority};
    }}));
    const created = store.create({id: 'region-1', state: {task: task()}});
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    region = created.value;
    const result = await region.publishData({results: [refA]});
    expect(result).toMatchObject({ok: false, diagnostics: [{code: 'runtime.region-revoked'}]});
    expect(region.snapshot().status).toBe('revoked');
  });

  it('rejects foreign, forged and replayed opaque tokens', async () => {
    const first = create();
    const secondStore = createRegionStore(options());
    const secondCreated = secondStore.create({id: 'region-2', state: {task: task('1', 'region-2')}});
    expect(secondCreated.ok).toBe(true);
    if (!secondCreated.ok) return;
    const staged = await first.region.stage({requestId: 'request-1', expected: first.region.snapshot().readSet!, state: {task: task()}});
    expect(staged.ok).toBe(true);
    if (!staged.ok) return;
    await expect(secondCreated.value.commit(staged.value)).resolves.toMatchObject({ok: false, diagnostics: [{code: 'runtime.region-invalid'}]});
    await expect(first.region.commit({} as never)).resolves.toMatchObject({ok: false, diagnostics: [{code: 'runtime.region-invalid'}]});
    await expect(first.region.commit(staged.value)).resolves.toMatchObject({ok: true});
    await expect(first.region.commit(staged.value)).resolves.toMatchObject({ok: false, diagnostics: [{code: 'runtime.region-invalid'}]});
  });

  it('rejects a result handle generation drift even when its logical ref is unchanged', async () => {
    let generation = 1;
    const handle = {
      get generation() { return generation; },
      key: {principalKey: 'principal-a', policyRevision: 'policy-1', catalogRevision: 'catalog-1', functionRegistryDigest: 'functions-1', outputId: 'rows', queryDigest: 'query-1', scopeDigest: 'scope-1'},
      snapshot: () => ({status: 'ready', descriptor: {ref: refA}}),
      retain: () => ({released: false, release() { this.released = true; }}),
    } as never;
    const {region} = create();
    const staged = await region.stage({requestId: 'request-1', expected: region.snapshot().readSet!, state: {task: task()}, resultHandles: [handle]});
    expect(staged.ok).toBe(true);
    if (!staged.ok) return;
    generation = 2;
    await expect(region.commit(staged.value)).resolves.toMatchObject({ok: false, diagnostics: [{code: 'runtime.region-stale'}]});
  });

  it('rejects a handle from another principal even when its scope reference matches', async () => {
    const handle = {
      get generation() { return 1; },
      key: {principalKey: 'principal-b', policyRevision: 'policy-1', catalogRevision: 'catalog-1', functionRegistryDigest: 'functions-1', outputId: 'rows', queryDigest: 'query-1', scopeDigest: 'scope-1'},
      snapshot: () => ({status: 'ready', descriptor: {ref: refA}}),
      retain: () => ({released: false, release() { this.released = true; }}),
    } as never;
    const {region} = create();
    await expect(region.stage({requestId: 'wrong-principal', expected: region.snapshot().readSet!, state: {task: task()}, resultHandles: [handle]})).resolves.toMatchObject({ok: false, diagnostics: [{code: 'runtime.region-stale'}]});
  });

  it('retains explicit result handles for the active region and releases them on revoke', async () => {
    const resultStore = createResultStore({maxEntries: 1});
    const resultHandle = resultStore.begin(resultKey);
    for await (const _update of resultHandle.subscribe(resultEvents())) { /* materialize the bounded handle */ }
    expect(resultHandle.snapshot().status).toBe('ready');
    resultHandle.release();
    const {store, region} = create();
    const staged = await region.stage({requestId: 'lease-request', expected: region.snapshot().readSet!, state: {task: task()}, resultHandles: [resultHandle]});
    expect(staged.ok).toBe(true);
    if (!staged.ok) return;
    await expect(region.commit(staged.value)).resolves.toMatchObject({ok: true});
    expect(() => resultStore.begin({...resultKey, requestId: 'other-result'})).toThrow(RangeError);
    expect(store.revoke('region-1')).toBe(true);
    expect(resultStore.begin({...resultKey, requestId: 'other-result'}).snapshot().status).toBe('refreshing');
    expect(resultHandle.snapshot().status).toBe('disposed');
  });

  it('keeps an unrelated output lease when publishing one output', async () => {
    const resultStore = createResultStore({maxEntries: 2});
    const handleA = resultStore.begin(resultKey);
    const handleB = resultStore.begin(resultKeyB);
    for await (const _update of handleA.subscribe(resultEvents())) { /* materialize A */ }
    for await (const _update of handleB.subscribe(resultEventsFor(refB, resultDescriptorB))) { /* materialize B */ }
    handleA.release();
    handleB.release();
    const {region} = create();
    const staged = await region.stage({requestId: 'multi-output', expected: region.snapshot().readSet!, state: {task: task()}, resultHandles: [handleA, handleB]});
    expect(staged.ok).toBe(true);
    if (!staged.ok) return;
    await expect(region.commit(staged.value)).resolves.toMatchObject({ok: true});
    await expect(region.publishData({resultHandles: [handleA]})).resolves.toMatchObject({ok: true});
    handleA.dispose();
    const spare = resultStore.begin({...resultKey, outputId: 'spare', requestId: 'spare'});
    spare.release();
    resultStore.begin({...resultKey, outputId: 'other', requestId: 'other'});
    expect(handleB.snapshot().status).toBe('ready');
  });

  it('bounds staged candidate retention', async () => {
    const {region} = create({maxStagedCommits: 1});
    const expected = region.snapshot().readSet!;
    const first = await region.stage({requestId: 'one', expected, state: {task: task()}});
    expect(first.ok).toBe(true);
    const second = await region.stage({requestId: 'two', expected, state: {task: task()}});
    expect(second.ok).toBe(false);
    if (!second.ok) expect(second.diagnostics[0]?.code).toBe('runtime.region-budget');
  });

  it('discards an unused staged token and releases its lease budget', async () => {
    let released = false;
    const handle = {
      get generation() { return 1; },
      key: {principalKey: 'principal-a', policyRevision: 'policy-1', catalogRevision: 'catalog-1', functionRegistryDigest: 'functions-1', outputId: 'rows', queryDigest: 'query-1', scopeDigest: 'scope-1'},
      snapshot: () => ({status: 'ready', descriptor: {ref: refA}}),
      retain: () => {
        let releasedLease = false;
        return {get released() { return releasedLease; }, release() { releasedLease = true; released = true; }};
      },
    } as never;
    const {region} = create({maxStagedCommits: 1});
    const expected = region.snapshot().readSet!;
    const first = await region.stage({requestId: 'discard-one', expected, state: {task: task()}, resultHandles: [handle]});
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    expect(region.discard(first.value)).toBe(true);
    expect(released).toBe(true);
    expect(region.discard(first.value)).toBe(false);
    const second = await region.stage({requestId: 'discard-two', expected, state: {task: task()}, resultHandles: [handle]});
    expect(second.ok).toBe(true);
  });

  it('uses a fresh opaque region incarnation after same-ID recreation', () => {
    const {store, region} = create();
    const previous = region.snapshot().regionRevision;
    region.dispose();
    const recreated = store.create({id: 'region-1', state: {task: task()}});
    expect(recreated.ok).toBe(true);
    if (recreated.ok) expect(recreated.value.snapshot().regionRevision).not.toBe(previous);
  });

  it('advances long nonnumeric task revisions without truncation repeats', async () => {
    const longRevision = 'x'.repeat(160);
    const store = createRegionStore(options());
    const created = store.create({id: 'region-1', state: {task: task(longRevision)}});
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    const {region} = {region: created.value};
    const first = await region.stage({requestId: 'long-one', expected: region.snapshot().readSet!, state: {task: task(longRevision)}});
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    const firstCommit = await region.commit(first.value);
    expect(firstCommit.ok).toBe(true);
    if (!firstCommit.ok) return;
    const revisionAfterFirst = firstCommit.value.taskRevision;
    const second = await region.stage({requestId: 'long-two', expected: region.snapshot().readSet!, state: {task: task(longRevision)}});
    expect(second.ok).toBe(true);
    if (!second.ok) return;
    const secondCommit = await region.commit(second.value);
    expect(secondCommit.ok).toBe(true);
    if (secondCommit.ok) expect(secondCommit.value.taskRevision).not.toBe(revisionAfterFirst);
  });

  it('keeps bounded immutable metadata history and isolates observer failures/reentrancy', async () => {
    const {region} = create({maxHistory: 3});
    const seen: string[] = [];
    let nested: Promise<unknown> | undefined;
    region.observe(() => { throw new Error('observer failure'); });
    region.observe((update) => {
      seen.push(update.kind);
      if (update.kind === 'commit' && nested === undefined) {
        const staged = region.stage({requestId: 'nested', expected: region.snapshot().readSet!, state: {task: task()}});
        nested = staged.then((result) => result.ok ? region.commit(result.value) : result);
      }
    });
    const first = await region.stage({requestId: 'first', expected: region.snapshot().readSet!, state: {task: task()}});
    expect(first.ok).toBe(true);
    if (first.ok) await region.commit(first.value);
    await nested;
    expect(seen).toEqual(['commit', 'commit']);
    expect(region.history()).toHaveLength(3);
    expect(Object.isFrozen(region.history())).toBe(true);
    expect(() => (region.history() as RegionHistoryEntry[]).pop()).toThrow();
  });

  it('stops later observers when an earlier observer revokes the region', async () => {
    const {region} = create();
    const seen: string[] = [];
    region.observe((update) => { seen.push(`first:${update.kind}`); if (update.kind === 'commit') region.revoke('user revoked'); });
    region.observe((update) => { seen.push(`second:${update.kind}`); });
    const staged = await region.stage({requestId: 'request-1', expected: region.snapshot().readSet!, state: {task: task()}});
    expect(staged.ok).toBe(true);
    if (staged.ok) await region.commit(staged.value);
    expect(seen).toEqual(['first:commit', 'first:revoke', 'second:revoke']);
    expect(region.snapshot().status).toBe('revoked');
  });

  it('clears protected state and rejects queued or late commands on revoke', async () => {
    let release: (() => void) | undefined;
    const {store, region} = create({authorizeCommit: () => new Promise((resolve) => {release = () => resolve({ok: true, value: undefined});})});
    const staged = await region.stage({requestId: 'request-1', expected: region.snapshot().readSet!, state: {task: task()}});
    expect(staged.ok).toBe(true);
    if (!staged.ok) return;
    const pending = region.commit(staged.value);
    await Promise.resolve();
    expect(store.revoke('region-1')).toBe(true);
    release?.();
    await expect(pending).resolves.toMatchObject({ok: false, diagnostics: [{code: 'runtime.region-revoked'}]});
    await expect(region.commit(staged.value)).resolves.toMatchObject({ok: false, diagnostics: [{code: 'runtime.region-revoked'}]});
    expect(region.snapshot().status).toBe('revoked');
    expect(region.snapshot().state).toBeUndefined();
    expect(region.snapshot().readSet).toBeUndefined();
    expect(region.history()).toHaveLength(0);
  });

  it('exports metadata without presentation plans and restores against fresh authority', async () => {
    const {store, region} = create();
    const document = region.export();
    expect(document).not.toHaveProperty('presentation');
    expect(JSON.stringify(document)).not.toContain('raw-row-value');
    const serialized = serializeRegionDocument(region.snapshot(), region.history());
    expect(parseRegionDocument(serialized).ok).toBe(true);
    await expect(store.restore(serialized)).resolves.toMatchObject({ok: false}); // stable ID is already occupied
    const fresh = createRegionStore(options());
    const restored = await fresh.restore(serialized);
    expect(restored.ok).toBe(true);
    if (restored.ok) expect(restored.value.snapshot().state?.task.revision).toBe('1');
    authority = {...authority, policyRevision: 'policy-2'};
    expect((await createRegionStore(options()).restore(serialized)).ok).toBe(true);
  });

  it('fails closed when restore has no host requery callback and does not attach observers after revoke', async () => {
    const {region} = create();
    const document = region.export();
    const noRestore = createRegionStore({readAuthority: () => ({ok: true as const, value: authority}), authorizeCommit: async () => ({ok: true as const, value: undefined})});
    await expect(noRestore.restore(document)).resolves.toMatchObject({ok: false, diagnostics: [{code: 'runtime.region-denied'}]});
    region.revoke();
    const observer = region.observe(() => { throw new Error('should not be called'); });
    expect(observer.closed).toBe(true);
  });

  it('fails closed when the host grant is missing', () => {
    const store = createRegionStore({readAuthority: () => ({ok: true, value: authority})} as never);
    const created = store.create({id: 'region-1', state: {task: task()}});
    expect(created.ok).toBe(false);
    if (!created.ok) expect(created.diagnostics[0]?.code).toBe('runtime.region-denied');
  });

  it('rejects truthy malformed host outcomes instead of treating them as approval', () => {
    const store = createRegionStore({
      readAuthority: () => ({ok: 'yes', value: authority}),
      authorizeCommit: async () => ({ok: 'yes', value: undefined}),
    } as never);
    const created = store.create({id: 'region-1', state: {task: task()}});
    expect(created.ok).toBe(false);
    if (!created.ok) expect(created.diagnostics[0]?.code).toBe('runtime.region-denied');
  });
});
