import {describe, expect, it} from 'vitest';
import {createResultStore, type ResultEvent} from '../../packages/runtime/src/results/index.js';

const ref = {id: 'result-1', revision: 'source-1', outputId: 'rows', queryDigest: 'query-1', scopeDigest: 'scope-1'} as const;
const field = {id: 'id', label: 'ID', type: {value: 'text' as const, nullable: false}, role: 'identity' as const};
const descriptor = {
  version: '1' as const, ref, taskId: 'task-1', fields: [field], identity: ['id'], rowGrain: ['id'],
  counts: {loaded: 1, population: {kind: 'exact' as const, value: 1, populationDigest: 'population-1'}},
  precision: {kind: 'exact' as const}, coverage: {kind: 'complete' as const, populationDigest: 'population-1'},
  consistency: {kind: 'snapshot' as const, snapshotId: 'snapshot-1', sourceRevisions: {employees: 'source-1'}},
  evidence: {kind: 'observed' as const, source: {id: 'employees', revision: 'source-1'}}, filters: [], warnings: [], lineage: [],
} as const;
const completeEvents: readonly ResultEvent[] = [
  {kind: 'descriptor', descriptor},
  {kind: 'batch', result: ref, sequence: 0, rows: [{id: 'a'}]},
  {kind: 'complete', result: ref, finalCoverage: descriptor.coverage},
];
const key = (requestId: string) => ({
  principalKey: 'principal-a', scopeDigest: 'scope-1', policyRevision: 'policy-1', queryDigest: 'query-1',
  catalogRevision: 'catalog-1', functionRegistryDigest: 'functions-1', sourceRevision: 'source-1',
  outputId: 'rows', taskId: 'task-1', requestId, populationDigest: 'population-1',
});

async function* from(events: readonly unknown[]): AsyncGenerator<unknown> {
  for (const event of events) yield event;
}

async function drain(handle: ReturnType<ReturnType<typeof createResultStore>['begin']>, source: AsyncIterable<unknown>): Promise<void> {
  for await (const _update of handle.subscribe(source)) { /* consume */ }
}

describe('result lifecycle regressions', () => {
  it('keeps a live lease from max-entry eviction and TTL expiry', () => {
    const bounded = createResultStore({maxEntries: 1});
    const pinned = bounded.begin(key('pinned'));
    const lease = pinned.retain();
    pinned.release();
    bounded.begin({...key('other'), outputId: 'other'});
    expect(lease.released).toBe(false);
    expect(pinned.snapshot().status).not.toBe('disposed');

    let now = 0;
    const expiring = createResultStore({ttlMs: 10, now: () => now});
    const retained = expiring.begin(key('retained'));
    const retainedLease = retained.retain();
    retained.release();
    now = 20;
    expect(expiring.get(retained.key)).toBe(retained);
    expect(retainedLease.released).toBe(false);
    expect(retained.snapshot().status).not.toBe('disposed');
  });

  it('preserves the same-slot carry when maxEntries is one', async () => {
    const store = createResultStore({maxEntries: 1});
    const first = store.begin(key('first'));
    await drain(first, from(completeEvents));
    first.release();

    const refresh = store.begin(key('refresh'));
    expect(refresh.snapshot().status).toBe('refreshing');
    expect(refresh.snapshot().loadedRows).toBe(1);
    await drain(refresh, from([{
      kind: 'error', requestId: 'refresh',
      error: {code: 'SOURCE_UNAVAILABLE', message: 'Unavailable', retryable: true},
    }]));
    expect(refresh.snapshot().status).toBe('stale');
    expect(refresh.snapshot().batches[0]?.rows[0]?.id).toBe('a');
  });

  it('does not promote a complete row result when exact population rows are missing', async () => {
    const badDescriptor = {
      ...descriptor,
      counts: {loaded: 1, population: {kind: 'exact' as const, value: 2, populationDigest: 'population-1'}},
    };
    const handle = createResultStore().begin(key('count-mismatch'));
    await drain(handle, from([
      {kind: 'descriptor', descriptor: badDescriptor},
      completeEvents[1],
      {kind: 'complete', result: ref, finalCoverage: badDescriptor.coverage},
    ]));
    expect(handle.snapshot().status).toBe('failed');
    expect(handle.snapshot().diagnostics[0]?.code).toBe('data.result-count');
  });

  it('does not accept evidence from a source revision outside the descriptor pins', async () => {
    const badEvidenceDescriptor = {
      ...descriptor,
      evidence: {kind: 'observed' as const, source: {id: 'employees', revision: 'source-other'}},
    };
    const handle = createResultStore().begin(key('evidence-mismatch'));
    await drain(handle, from([
      {kind: 'descriptor', descriptor: badEvidenceDescriptor},
      completeEvents[1],
      {kind: 'complete', result: ref, finalCoverage: badEvidenceDescriptor.coverage},
    ]));
    expect(handle.snapshot().status).toBe('failed');
    expect(handle.snapshot().diagnostics[0]?.code).toBe('data.result-evidence');
  });

  it('cancels an idle subscription when its signal aborts', () => {
    const handle = createResultStore().begin(key('idle-abort'));
    const controller = new AbortController();
    handle.subscribe({next: () => new Promise<IteratorResult<unknown>>(() => {})}, {signal: controller.signal});
    controller.abort();
    expect(handle.snapshot().status).toBe('cancelled');
  });
});
