import { expect, it } from 'vitest';
import { createParallelScopeFixture, createScopeFixture } from './fixtures/scope.js';

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
  const f = await createParallelScopeFixture();
  const leftA = f.leftOrders();
  const rightA = f.rightOrders;
  expect(leftA.id).toBe(rightA.id);
  expect(leftA.address.scopeInstanceId).not.toBe(rightA.address.scopeInstanceId);
  const leftResult = await leftA.request({ kind: 'browse' });
  const rightResult = await rightA.request({ kind: 'browse' });
  expect(leftResult).toEqual({ status: 'committed', revision: '1' });
  expect(rightResult).toEqual({ status: 'committed', revision: '1' });
  expect(leftA.getSnapshot().state.rows).toEqual([
    expect.objectContaining({ workspace: 'organization:north/workspace:acme' }),
  ]);
  expect(rightA.getSnapshot().state.rows).toEqual([
    expect.objectContaining({ workspace: 'organization:south/workspace:acme' }),
  ]);
  expect(new Set(f.authorityDigests.map((entry) => entry.scopeDigest))).toEqual(
    new Set(['organization:north/workspace:acme', 'organization:south/workspace:acme']),
  );
  f.revokeRuntime({ kind: 'workspace', id: 'acme', lineage: [{ kind: 'organization', id: 'north' }] });
  await expect(leftA.request({ kind: 'browse' })).resolves.toMatchObject({ status: 'denied' });
  const rightAddress = rightA.address;
  await expect(rightA.request({ kind: 'browse' })).resolves.toMatchObject({ status: 'committed' });
  expect(rightA.address).toBe(rightAddress);
  expect(f.rightScope.getSnapshot()).toMatchObject({ status: 'active', selector: { lineage: [{ id: 'south' }] } });
  f.allowRuntime({ kind: 'workspace', id: 'acme', lineage: [{ kind: 'organization', id: 'north' }] });
  const rightBefore = rightA.getSnapshot();
  const nested = {
    kind: 'workspace',
    id: 'globex',
    lineage: [{ kind: 'organization', id: 'north' }],
  } as const;

  const changed = await f.changeLeft(nested);
  expect(changed.result).toMatchObject({ status: 'active', selector: nested });
  expect(changed.previous.getSnapshot().phase).toBe('disposed');
  await changed.current.request({ kind: 'browse' });
  expect(changed.current.getSnapshot().state.rows).toEqual([
    expect.objectContaining({ workspace: 'organization:north/workspace:globex' }),
  ]);
  expect(rightA.getSnapshot()).toBe(rightBefore);
  await expect(changed.previous.request({ kind: 'browse' })).resolves.toMatchObject({ status: 'disposed' });

  f.disposeLeft();
  expect(changed.current.getSnapshot().phase).toBe('disposed');
  expect(f.rightScope.getSnapshot()).toMatchObject({ status: 'active', selector: { id: 'acme' } });
  await expect(rightA.request({ kind: 'browse' })).resolves.toMatchObject({ status: 'committed' });
  f.dispose();
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

it('copies and freezes host diagnostics before publishing an initial failure', async () => {
  const f = await createScopeFixture();
  const delayed = f.host.deferResolve('acme');
  const hostDiagnostic = {
    code: 'scope.host-denied',
    message: 'Original message.',
    retryable: false,
    path: ['workspace', 0] as (string | number)[],
    remedies: ['Request access.'],
  };
  const detach = f.scope.attach();
  await delayed.started;
  delayed.resolve({ ok: false, diagnostics: [hostDiagnostic] });
  await waitFor(() => f.scope.getSnapshot().status === 'denied');
  const published = f.scope.getSnapshot().diagnostic;
  hostDiagnostic.message = 'Mutated message.';
  hostDiagnostic.path.push('mutated');
  hostDiagnostic.remedies.push('Mutated remedy.');

  expect(published).toEqual({
    code: 'scope.host-denied',
    message: 'Original message.',
    retryable: false,
    path: ['workspace', 0],
    remedies: ['Request access.'],
  });
  expect(Object.isFrozen(published)).toBe(true);
  expect(Object.isFrozen(published?.path)).toBe(true);
  expect(Object.isFrozen(published?.remedies)).toBe(true);
  detach();
  await f.dispose();

  const malformed = await createScopeFixture();
  const malformedResolution = malformed.host.deferResolve('acme');
  const malformedDetach = malformed.scope.attach();
  await malformedResolution.started;
  malformedResolution.resolve({
    ok: false,
    diagnostics: [{ code: 'scope.host-denied', message: '', retryable: false }],
  });
  await waitFor(() => malformed.scope.getSnapshot().status === 'denied');
  expect(malformed.scope.getSnapshot().diagnostic).toMatchObject({ code: 'scope.resolve-invalid' });
  expect(Object.isFrozen(malformed.scope.getSnapshot().diagnostic)).toBe(true);
  malformedDetach();
  await malformed.dispose();
});

it.each(['throw', 'return', 'null', 'getter'] as const)(
  'cleans partial B effects when activation chooses to %s',
  async (mode) => {
    const f = await createScopeFixture();
    await f.activate('acme');
    f.host.failActivate('globex', mode);

    await expect(f.scope.requestChange({ kind: 'workspace', id: 'globex' })).resolves.toMatchObject({
      status: 'failed',
    });
    expect(f.scope.getSnapshot()).toMatchObject({ status: 'denied', selector: null });
    expect(f.host.events.slice(-2)).toEqual(['activate:globex', 'deactivate:globex']);
    expect(f.actions.hasActive()).toBe(false);
    await f.dispose();
  },
);

it('contains malformed initial activation and throwing compensation after clearing host effects', async () => {
  const f = await createScopeFixture();
  f.host.failActivate('acme', 'getter');
  f.host.failDeactivate();
  const detach = f.scope.attach();

  await waitFor(() => f.scope.getSnapshot().status === 'denied');
  expect(f.scope.getSnapshot()).toMatchObject({ status: 'denied', selector: null });
  expect(f.host.events).toEqual(['activate:acme', 'deactivate:acme']);
  expect(f.actions.hasActive()).toBe(false);
  detach();
  await f.dispose();
});

it('contains malformed and throwing initial authorization before activation', async () => {
  const malformed = await createScopeFixture();
  malformed.host.setRawAuthorize(
    'acme',
    new Proxy(
      {},
      {
        get() {
          throw new Error('authorization outcome getter failed');
        },
      },
    ),
  );
  const malformedDetach = malformed.scope.attach();
  await waitFor(() => malformed.scope.getSnapshot().status === 'denied');
  expect(malformed.scope.getSnapshot().diagnostic).toMatchObject({ code: 'scope.permission-check-failed' });
  expect(malformed.host.events).not.toContain('activate:acme');
  malformedDetach();
  await malformed.dispose();

  const throwing = await createScopeFixture();
  throwing.host.throwAuthorize('acme');
  const throwingDetach = throwing.scope.attach();
  await waitFor(() => throwing.scope.getSnapshot().status === 'denied');
  expect(throwing.scope.getSnapshot().diagnostic).toMatchObject({ code: 'scope.permission-check-failed' });
  expect(throwing.host.events).not.toContain('activate:acme');
  throwingDetach();
  await throwing.dispose();
});
