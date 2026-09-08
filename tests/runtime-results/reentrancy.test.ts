import {describe, expect, it} from 'vitest';
import {createResultStore} from '../../packages/runtime/src/results/index.js';

const key = (requestId: string) => ({
  principalKey: 'principal-a', scopeDigest: 'scope-1', policyRevision: 'policy-1', queryDigest: 'query-1',
  catalogRevision: 'catalog-1', functionRegistryDigest: 'functions-1', sourceRevision: 'source-1',
  outputId: 'rows', taskId: 'task-1', requestId, populationDigest: 'population-1',
});

describe('result cleanup reentrancy', () => {
  it('clears rows before source cleanup runs during revoke', async () => {
    const store = createResultStore();
    const handle = store.begin(key('revoke'));
    let duringReturn: ReturnType<typeof handle.snapshot> | undefined;
    const source: AsyncIterator<unknown> = {
      next: () => new Promise<IteratorResult<unknown>>(() => {}),
      return: () => {
        duringReturn = handle.snapshot();
        return Promise.resolve({done: true, value: undefined});
      },
    };
    const subscription = handle.subscribe(source);
    const pending = subscription.next();
    store.revoke({principalKey: 'principal-a'});
    expect(duringReturn?.status).toBe('denied');
    expect(duringReturn?.loadedRows).toBe(0);
    expect(duringReturn?.batches).toHaveLength(0);
    await expect(pending).resolves.toMatchObject({done: true});
  });

  it('clears rows before source cleanup runs during dispose', async () => {
    const store = createResultStore();
    const handle = store.begin(key('dispose'));
    let duringReturn: ReturnType<typeof handle.snapshot> | undefined;
    const source: AsyncIterator<unknown> = {
      next: () => new Promise<IteratorResult<unknown>>(() => {}),
      return: () => {
        duringReturn = handle.snapshot();
        return Promise.resolve({done: true, value: undefined});
      },
    };
    const subscription = handle.subscribe(source);
    const pending = subscription.next();
    store.dispose();
    expect(duringReturn?.status).toBe('disposed');
    expect(duringReturn?.loadedRows).toBe(0);
    expect(duringReturn?.batches).toHaveLength(0);
    await expect(pending).resolves.toMatchObject({done: true});
  });
});
