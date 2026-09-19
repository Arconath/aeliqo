import { expect, it } from 'vitest';
import { createScopeFixture } from './fixtures/scope.js';

async function waitFor(predicate: () => boolean): Promise<void> {
  for (let attempt = 0; attempt < 20 && !predicate(); attempt++) await Promise.resolve();
  expect(predicate()).toBe(true);
}

it('keeps scope construction inert and attach lifecycle idempotent', async () => {
  const f = await createScopeFixture();
  expect(f.host.resolveCalls).toBe(0);
  expect(f.scope.getSnapshot()).toMatchObject({ status: 'idle', selector: null, activationEpoch: 0 });

  const detach = f.scope.attach();
  await waitFor(() => f.scope.getSnapshot().status === 'active');
  expect(f.host.resolveCalls).toBe(1);
  expect(f.scope.getSnapshot()).toMatchObject({ status: 'active', selector: { id: 'acme' }, activationEpoch: 1 });
  expect(f.fenceSubscriptions()).toBe(0);
  detach();
  detach();
  const detachAgain = f.scope.attach();
  await Promise.resolve();
  expect(f.host.resolveCalls).toBe(1);
  detachAgain();
  await f.dispose();
});

it('restarts initial resolution after the last attachment detaches', async () => {
  const f = await createScopeFixture();
  const delayed = f.host.deferResolve('acme');
  const detach = f.scope.attach();
  await delayed.started;
  expect(f.scope.getSnapshot()).toMatchObject({ status: 'resolving', selector: null });
  detach();
  delayed.resolve();
  await Promise.resolve();
  expect(f.scope.getSnapshot()).toMatchObject({ status: 'idle', selector: null });

  const detachAgain = f.scope.attach();
  await waitFor(() => f.scope.getSnapshot().status === 'active');
  expect(f.host.resolveCalls).toBe(2);
  detachAgain();
  await f.dispose();
});

it('keeps A active while B resolves and starts B effects only after acceptance', async () => {
  const f = await createScopeFixture();
  await f.activate('acme');
  const a = f.currentOrders();
  await expect(a.request({ kind: 'browse' })).resolves.toMatchObject({ status: 'committed' });
  const delayed = f.host.deferResolve('globex');
  const pending = f.scope.requestChange({ kind: 'workspace', id: 'globex' });
  await delayed.started;

  expect(f.scope.getSnapshot()).toMatchObject({
    status: 'active',
    selector: { id: 'acme' },
    pending: { selector: { id: 'globex' }, phase: 'resolving' },
  });
  expect(f.currentOrders()).toBe(a);
  expect(f.view.readRows()).toContainEqual(f.source.acmePrivateRow);
  expect(f.source.callsFor('globex')).toBe(0);

  delayed.resolve();
  await expect(pending).resolves.toMatchObject({ status: 'active', selector: { id: 'globex' } });
  expect(f.host.events.slice(-2)).toEqual(['deactivate:acme', 'activate:globex']);
  const b = f.currentOrders();
  expect(b).not.toBe(a);
  expect(f.view.readRows()).toEqual([]);
  await expect(b.request({ kind: 'browse' })).resolves.toMatchObject({ status: 'committed' });
  expect(f.view.readRows()).toEqual([{ id: 'globex-order', workspace: 'globex', total: 73 }]);
  await f.dispose();
});

it('fails closed when B is denied after A authority is revoked', async () => {
  const f = await createScopeFixture();
  await f.activate('acme');
  const a = f.currentOrders();
  await a.request({ kind: 'browse' });
  const delayed = f.host.deferResolve('globex');
  const pending = f.scope.requestChange({ kind: 'workspace', id: 'globex' });
  await delayed.started;
  f.host.revoke('acme');
  delayed.resolve({
    ok: false,
    diagnostics: [{ code: 'scope.membership-denied', message: 'B denied.', retryable: false }],
  });

  await expect(pending).resolves.toMatchObject({ status: 'denied' });
  expect(f.scope.getSnapshot()).toMatchObject({ status: 'denied', selector: null });
  expect(f.view.readRows()).toEqual([]);
  await f.dispose();
});

it('keeps authorized A and starts no B effects when B membership is denied', async () => {
  const f = await createScopeFixture();
  await f.activate('acme');
  const a = f.currentOrders();
  await a.request({ kind: 'browse' });
  f.host.deny('globex');

  await expect(f.scope.requestChange({ kind: 'workspace', id: 'globex' })).resolves.toMatchObject({
    status: 'denied',
    diagnosticCode: 'scope.membership-denied',
  });
  expect(f.scope.getSnapshot()).toMatchObject({ status: 'active', selector: { id: 'acme' } });
  expect(f.scope.getSnapshot().pending).toBeUndefined();
  expect(f.currentOrders()).toBe(a);
  expect(f.view.readRows()).toContainEqual(f.source.acmePrivateRow);
  expect(f.source.callsFor('globex')).toBe(0);
  await f.dispose();
});

it('keeps full lineage and parallel scope instances isolated for equal business IDs', async () => {
  const left = await createScopeFixture();
  const right = await createScopeFixture();
  await Promise.all([left.activate('acme'), right.activate('acme')]);
  const leftA = left.currentOrders();
  const rightA = right.currentOrders();
  const nested = {
    kind: 'workspace',
    id: 'acme',
    lineage: [{ kind: 'organization', id: 'north' }],
  } as const;

  await expect(left.scope.requestChange(nested)).resolves.toMatchObject({ status: 'active', selector: nested });
  expect(left.scope.getSnapshot().selector).toEqual(nested);
  expect(left.currentOrders()).not.toBe(leftA);
  expect(right.scope.getSnapshot().selector).toEqual({ kind: 'workspace', id: 'acme' });
  expect(right.currentOrders()).toBe(rightA);
  expect(left.scope.getSnapshot().scopeInstanceId).not.toBe(right.scope.getSnapshot().scopeInstanceId);
  await Promise.all([left.dispose(), right.dispose()]);
});

it('copies trusted resolutions and rejects overlong lineage without retaining host-owned objects', async () => {
  const f = await createScopeFixture();
  await f.activate('acme');
  f.host.mutateLastResolution();
  expect(f.scope.getSnapshot().selector).toEqual({ kind: 'workspace', id: 'acme' });
  expect(f.scope.authorize('orders')).toMatchObject({ ok: true });

  await expect(
    f.scope.requestChange({
      kind: 'workspace',
      id: 'globex',
      lineage: Array.from({ length: 17 }, (_, index) => ({ kind: 'organization', id: `org-${index}` })),
    }),
  ).rejects.toThrow('lineage');
  await f.dispose();
});
