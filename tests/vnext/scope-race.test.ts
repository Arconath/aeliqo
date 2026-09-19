import { expect, it } from 'vitest';
import { createScopeFixture } from './fixtures/scope.js';

it('never retargets a captured A handle or accepts its late result after A-B-A', async () => {
  const f = await createScopeFixture();
  await f.activate('acme');
  const a1 = f.currentOrders();
  const deferred = f.source.deferNext();
  const pending = a1.request({ kind: 'browse' });
  await deferred.started;
  expect((await f.scope.requestChange({ kind: 'workspace', id: 'globex' })).status).toBe('active');
  expect(f.view.readRows()).not.toContainEqual(f.source.acmePrivateRow);
  expect(['stale', 'cancelled', 'disposed']).toContain((await a1.request({ kind: 'browse' })).status);
  expect((await f.scope.requestChange({ kind: 'workspace', id: 'acme' })).status).toBe('active');
  const a2 = f.currentOrders();
  expect(a2.address.activationEpoch).toBeGreaterThan(a1.address.activationEpoch);
  expect(a2).not.toBe(a1);
  await a2.request({ kind: 'browse' }); // a fresh A2 read, not the deferred A1 read
  const beforeLateA1 = a2.getSnapshot();
  await f.release('acme'); // wait for the observed A1 transport completion, ignoring cancellation
  const outcome = await pending;
  expect(['stale', 'cancelled']).toContain(outcome.status);
  expect(a2.getSnapshot()).toBe(beforeLateA1);
  await f.dispose();
});

it('clears a cancelled pending resolution and fences an observed in-flight request', async () => {
  const f = await createScopeFixture();
  await f.activate('acme');
  expect(f.fenceSubscriptions()).toBe(0);
  const source = f.source.deferNext();
  const read = f.currentOrders().request({ kind: 'browse' });
  await source.started;
  expect(f.fenceSubscriptions()).toBe(1);

  const delayed = f.host.deferResolve('globex');
  const controller = new AbortController();
  const pending = f.scope.requestChange({ kind: 'workspace', id: 'globex' }, { signal: controller.signal });
  await delayed.started;
  controller.abort();
  delayed.resolve();
  await expect(pending).resolves.toMatchObject({ status: 'cancelled' });
  expect(f.scope.getSnapshot()).toMatchObject({ status: 'active', selector: { id: 'acme' } });
  expect(f.scope.getSnapshot().pending).toBeUndefined();
  source.resolve();
  await read;
  expect(f.fenceSubscriptions()).toBe(0);
  await f.dispose();
});

it('lets C win out-of-order A-B-C membership resolution and disposes fenced children', async () => {
  const f = await createScopeFixture();
  await f.activate('acme');
  const a = f.currentOrders();
  const b = f.host.deferResolve('globex');
  const bPending = f.scope.requestChange({ kind: 'workspace', id: 'globex' });
  await b.started;
  const c = f.host.deferResolve('initech');
  const cPending = f.scope.requestChange({ kind: 'workspace', id: 'initech' });
  await c.started;
  c.resolve();
  await expect(cPending).resolves.toMatchObject({ status: 'active', selector: { id: 'initech' } });
  const active = f.currentOrders();
  b.resolve();
  await expect(bPending).resolves.toMatchObject({ status: 'cancelled' });
  expect(f.scope.getSnapshot()).toMatchObject({ status: 'active', selector: { id: 'initech' } });
  expect(f.currentOrders()).toBe(active);
  expect(a.getSnapshot().phase).toBe('disposed');
  expect(f.fenceSubscriptions()).toBe(0);
  await f.dispose();
});

it('rejects an A cursor in B through the real runtime data and result path', async () => {
  const f = await createScopeFixture();
  await f.activate('acme');
  const a = f.currentOrders();
  await expect(a.request({ kind: 'browse', page: { size: 1 } })).resolves.toMatchObject({ status: 'committed' });
  const cursor = a.getSnapshot().state.cursor;
  expect(cursor).toBeTypeOf('string');
  if (cursor === undefined) throw new TypeError('Expected an A cursor.');

  await f.scope.requestChange({ kind: 'workspace', id: 'globex' });
  const b = f.currentOrders();
  await expect(b.request({ kind: 'browse', page: { size: 1, cursor } })).resolves.not.toMatchObject({
    status: 'committed',
  });
  expect(b.getSnapshot().state.rows).toEqual([]);
  await f.dispose();
});

it('revokes A previews while preserving a late executing backend effect as A work', async () => {
  const f = await createScopeFixture();
  await f.activate('acme');
  const portA = f.actions.current();
  const preview = await portA.preview({
    requestId: 'preview-a',
    action: f.actions.descriptor.ref,
    input: { id: 'order-a' },
    idempotencyKey: 'preview-a',
  });
  if (!preview.ok) throw new Error(preview.diagnostics[0].message);
  await f.scope.requestChange({ kind: 'workspace', id: 'globex' });
  const deniedConfirmation = await portA.confirm(preview.value);
  expect(deniedConfirmation).toMatchObject({ ok: false, diagnostics: [{ code: 'action.revoked' }] });
  expect(f.actions.current()).not.toBe(portA);
  await f.dispose();

  const executing = await createScopeFixture();
  await executing.activate('acme');
  const executingPort = executing.actions.current();
  const nextPreview = await executingPort.preview({
    requestId: 'execute-a',
    action: executing.actions.descriptor.ref,
    input: { id: 'order-a' },
    idempotencyKey: 'execute-a',
  });
  if (!nextPreview.ok) throw new Error(nextPreview.diagnostics[0].message);
  const receipt = await executingPort.confirm(nextPreview.value);
  if (!receipt.ok) throw new Error(receipt.diagnostics[0].message);
  const dispatch = executing.actions.deferNextDispatch();
  const running = executingPort.execute(receipt.value);
  await dispatch.started;
  await executing.scope.requestChange({ kind: 'workspace', id: 'globex' });
  dispatch.resolve({ state: 'completed', output: { saved: true } });
  await expect(running).resolves.toMatchObject({ ok: true, value: { state: 'ambiguous' } });
  expect(executing.actions.backendEffects).toEqual([{ scopeId: 'acme', input: { id: 'order-a' } }]);
  await executing.dispose();
});

it('retires a controlled A proposal before a late host acceptance', async () => {
  const f = await createScopeFixture();
  await f.activate('acme');
  const controlled = f.createControlledOrders();
  const proposed = await controlled.surface.request({ kind: 'browse' });
  if (proposed.status !== 'proposed') throw new Error('Expected a controlled proposal.');
  expect(f.fenceSubscriptions()).toBe(1);
  await f.scope.requestChange({ kind: 'workspace', id: 'globex' });
  controlled.accept(proposed.proposalId);
  expect(controlled.surface.getSnapshot()).toMatchObject({ state: { rows: [] } });
  expect(['denied', 'disposed']).toContain(controlled.surface.getSnapshot().phase);
  expect(f.fenceSubscriptions()).toBe(0);
  await f.dispose();
});

it('keeps child registration and Region ownership bounded across repeated A-B-A activations', async () => {
  const f = await createScopeFixture();
  await f.activate('acme');
  let previous = f.currentOrders();
  let generation = previous.address.surfaceGeneration;

  for (let index = 0; index < 20; index++) {
    const id = index % 2 === 0 ? 'globex' : 'acme';
    await expect(f.scope.requestChange({ kind: 'workspace', id })).resolves.toMatchObject({ status: 'active' });
    const current = f.currentOrders();
    expect(previous.getSnapshot().phase).toBe('disposed');
    expect(current.address.surfaceGeneration).toBeGreaterThan(generation);
    expect(f.fenceSubscriptions()).toBe(0);
    generation = current.address.surfaceGeneration;
    previous = current;
  }

  expect(f.retiredSurfaces()).toBe(20);
  await expect(f.currentOrders().request({ kind: 'browse' })).resolves.toMatchObject({ status: 'committed' });
  await f.dispose();
});
