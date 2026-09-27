import { expect, it, vi } from 'vitest';
import type { InteractionPayload } from '../../packages/core/src/index.js';
import type {
  ActionPort,
  ActionPreview,
  ActionExecution,
  ActionReceipt,
} from '../../packages/runtime/src/actions/index.js';
import type { WebAppContext, WebRegion } from '../../packages/web/src/app/context.js';
import type { AeliqoAppActionEvent } from '../../packages/web/src/app/types.js';
import type { AeliqoSemanticInteractionRequest } from '../../packages/web/src/region/types.js';
import { createInteractionHandler, cancelActiveAction } from '../../packages/web/src/app/interaction.js';

const draft: Extract<InteractionPayload, { kind: 'draft' }> = {
  kind: 'draft',
  entity: 'people',
  key: 'ada',
  field: 'name',
  value: 'Ada edited',
  entityRevision: '1',
};
const action = { id: 'people.save', revision: '1' };
const preview = { state: 'preview', id: 'preview-1', action } as ActionPreview;
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

function fixture(actionMatches = true) {
  let taskRevision = 'task-1';
  let principalKey = 'user';
  let captured: Extract<AeliqoAppActionEvent, { state: 'preview' }> | undefined;
  const execution = deferred<{ ok: true; value: ActionExecution }>();
  const beforePreview = deferred<{ ok: true; value: ActionPreview }>();
  const port = {
    preview: vi.fn(() => beforePreview.promise),
    confirm: vi.fn(async () => ({ ok: true, value: { id: 'receipt-1' } as ActionReceipt })),
    execute: vi.fn(() => execution.promise),
    cancel: vi.fn(() => true),
  } as unknown as ActionPort;
  const region = {
    id: 'main',
    resourceId: 'people',
    sequence: 0,
    actionSequence: 0,
    actionPending: false,
    values: new Map(),
    drafts: new Map([['name', draft]]),
    element: { interaction: undefined },
  } as unknown as WebRegion;
  const context = {
    disposed: false,
    options: {
      onActionEvent: (event: AeliqoAppActionEvent) => {
        if (event.state === 'preview') captured = event;
      },
      authority: {
        read: () => ({
          ok: true,
          value: {
            principalKey,
            scopeDigest: 'scope',
            policyRevision: '1',
            experienceRevision: '1',
            grants: ['action.execute'],
          },
        }),
      },
    },
    regions: new Map([['main', region]]),
    runtime: {
      actionPort: port,
      snapshot: () => ({
        region: {
          taskRevision,
          state: { task: { kind: 'form', action: actionMatches ? action : { id: 'people.unrelated', revision: '1' } } },
        },
      }),
    },
  } as unknown as WebAppContext;
  const request = {
    nodeId: 'form',
    portId: 'submit',
    payload: { kind: 'action-request', action, input: {} },
  } as unknown as AeliqoSemanticInteractionRequest;
  const handler = createInteractionHandler(context);
  return {
    region,
    context,
    port,
    beforePreview,
    execution,
    start: () => handler(region, request),
    confirm: () => {
      if (!captured) throw new Error('No preview');
      return captured.confirm();
    },
    task: () => {
      taskRevision = 'new-task';
    },
    principal: () => {
      principalKey = 'another-user';
    },
    finish: (state: 'executed' | 'ambiguous' = 'executed') =>
      execution.resolve({
        ok: true,
        value:
          state === 'executed'
            ? { state, receiptId: 'receipt-1', action, output: {} }
            : { state, receiptId: 'receipt-1', action, reason: 'unknown effect' },
      }),
  };
}
async function confirmed(state: ReturnType<typeof fixture>) {
  const pending = state.start();
  state.beforePreview.resolve({ ok: true, value: preview });
  await pending;
  return { result: state.confirm() };
}

it('clears only draft objects captured before asynchronous preview', async () => {
  const state = fixture();
  const pending = state.start();
  const newer = { ...draft, value: 'Typed during preview' };
  state.region.drafts.set('name', newer);
  state.beforePreview.resolve({ ok: true, value: preview });
  await pending;
  const result = state.confirm();
  state.finish();
  await result;
  expect(state.region.drafts.get('name')).toBe(newer);
});

it('clears the saved current entries and republishes retained interaction', async () => {
  const state = fixture();
  const pending = await confirmed(state);
  state.finish();
  await pending.result;
  expect(state.region.drafts.size).toBe(0);
  expect(state.region.element.interaction?.drafts).toEqual([]);
  expect(state.region.draftRevision).toBe(1);
});

it.each(['cancelled', 'disposed', 'task', 'principal', 'replacement', 'new-action', 'ambiguous'] as const)(
  'preserves drafts after %s action completion',
  async (kind) => {
    const state = fixture();
    const pending = await confirmed(state);
    // Let the confirmation continuation enter the intentionally delayed transport.
    await Promise.resolve();
    if (kind === 'cancelled') cancelActiveAction(state.region);
    if (kind === 'disposed') state.context.disposed = true;
    if (kind === 'task') state.task();
    if (kind === 'principal') state.principal();
    if (kind === 'replacement') state.context.regions.delete('main');
    if (kind === 'new-action') {
      state.region.actionSequence++;
      state.region.actionAbort = new AbortController();
      state.region.actionPending = true;
    }
    state.finish(kind === 'ambiguous' ? 'ambiguous' : 'executed');
    await pending.result;
    expect(state.region.drafts.get('name')).toBe(draft);
    if (kind === 'new-action') expect(state.region.actionPending).toBe(true);
  },
);

it('does not treat an unrelated successful action as a saved form draft', async () => {
  const state = fixture(false);
  const pending = await confirmed(state);
  state.finish();
  await pending.result;
  expect(state.region.drafts.get('name')).toBe(draft);
});
