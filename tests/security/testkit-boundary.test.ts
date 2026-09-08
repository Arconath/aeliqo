import {describe, expect, it} from 'vitest';
import type {ResultEvent} from '../../packages/runtime/src/results/index.js';
import {
  collectResultEvents,
  type CollectResultEventsOptions,
} from '../../packages/testkit/src/index.js';
import {resultDescriptor} from './fixtures.js';

const descriptorEvent: ResultEvent = {
  kind: 'descriptor',
  descriptor: resultDescriptor(),
};

function runawaySource(onClose: () => void): AsyncIterable<ResultEvent> {
  return {
    [Symbol.asyncIterator](): AsyncIterator<ResultEvent> {
      return {
        async next() {
          return {done: false, value: descriptorEvent};
        },
        async return() {
          onClose();
          return {done: true, value: undefined};
        },
      };
    },
  };
}

function pendingSource(onClose: () => void): AsyncIterable<ResultEvent> {
  return {
    [Symbol.asyncIterator](): AsyncIterator<ResultEvent> {
      return {
        next() {
          return new Promise<IteratorResult<ResultEvent>>(() => undefined);
        },
        async return() {
          onClose();
          return {done: true, value: undefined};
        },
      };
    },
  };
}

describe('T28 bounded result collection', () => {
  it('closes a runaway producer at the event bound', async () => {
    let closed = false;
    const options: CollectResultEventsOptions = {maxEvents: 3, maxRows: 3, timeoutMs: 1_000};
    await expect(collectResultEvents(runawaySource(() => { closed = true; }), options))
      .rejects.toMatchObject({name: 'ResultCollectionLimitError'});
    expect(closed).toBe(true);
  });

  it('closes a producer that never resolves next() at the deadline', async () => {
    let closed = false;
    await expect(collectResultEvents(pendingSource(() => { closed = true; }), {
      maxEvents: 3,
      maxRows: 3,
      timeoutMs: 20,
    })).rejects.toMatchObject({name: 'ResultCollectionTimeoutError'});
    expect(closed).toBe(true);
  });

  it('closes a pending producer when the host aborts collection', async () => {
    let closed = false;
    const controller = new AbortController();
    const pending = collectResultEvents(pendingSource(() => { closed = true; }), {
      maxEvents: 3,
      maxRows: 3,
      timeoutMs: 1_000,
      signal: controller.signal,
    });
    await Promise.resolve();
    controller.abort('permission revoked');
    await expect(pending).rejects.toMatchObject({name: 'AbortError'});
    expect(closed).toBe(true);
  });
});
