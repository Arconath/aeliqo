import { parseInteractionState } from '@aeliqo/core/interaction';
import type { Diagnostic, InteractionPayload } from '@aeliqo/core';
import type {
  ActionExecution,
  ActionOutcome,
  ActionPort,
  ActionPreview,
  ActionRequest as RuntimeActionRequest,
} from '@aeliqo/runtime/actions';
import type { AeliqoSemanticInteractionRequest } from '../region/types.js';
import type { AeliqoAppActionEvent } from './types.js';
import { diagnostic, type WebAppContext, type WebRegion } from './context.js';

type ActionRequestPayload = Extract<InteractionPayload, { readonly kind: 'action-request' }>;
type RegionValuePayload = Extract<
  InteractionPayload,
  { readonly kind: 'selection' | 'filter' | 'range' | 'group' | 'page' }
>;

const REGION_VALUE_KINDS: ReadonlySet<InteractionPayload['kind']> = new Set([
  'selection',
  'filter',
  'range',
  'group',
  'page',
]);

interface ActionSession {
  active: boolean;
  readonly controller: AbortController;
  readonly preview: ActionPreview;
  cancel?: () => boolean;
}

function notifyAction(context: WebAppContext, event: AeliqoAppActionEvent): void {
  try {
    const pending = context.options.onActionEvent?.(event);
    if (pending !== undefined) void Promise.resolve(pending).catch(() => {});
  } catch {
    /* Application observers never control action authority. */
  }
}

export function cancelActiveAction(region: WebRegion): void {
  region.actionAbort?.abort();
  delete region.actionAbort;
  const cancel = region.cancelAction;
  delete region.cancelAction;
  cancel?.();
  region.actionPending = false;
}

function publishInteraction(region: WebRegion): void {
  const state = parseInteractionState({
    version: '1',
    values: [...region.values.values()],
    drafts: [...region.drafts.values()].map((draft) => ({
      domain: 'app.form',
      entity: draft.entity,
      key: draft.key,
      field: draft.field,
      value: draft.value,
      entityRevision: draft.entityRevision,
    })),
  });
  if (state.ok) region.element.interaction = state.value;
}

function saveInteraction(region: WebRegion, request: AeliqoSemanticInteractionRequest): void {
  const payload = request.payload;
  if (payload.kind === 'draft') {
    region.drafts.set(JSON.stringify([payload.entity, payload.key, payload.field]), payload);
    delete region.actionAttempt;
    publishInteraction(region);
    return;
  }
  if (!isRegionValue(payload)) return;
  region.values.set(JSON.stringify([request.nodeId, request.portId]), {
    nodeId: request.nodeId,
    portId: request.portId,
    payload,
  });
  publishInteraction(region);
}

function isRegionValue(payload: InteractionPayload): payload is RegionValuePayload {
  return REGION_VALUE_KINDS.has(payload.kind);
}

function clearPendingAction(region: WebRegion, session: ActionSession): void {
  if (region.actionAbort === session.controller) delete region.actionAbort;
  if (region.cancelAction === session.cancel) delete region.cancelAction;
  region.actionPending = false;
}

function cancelPreview(port: ActionPort, region: WebRegion, session: ActionSession): boolean {
  if (!session.active) return false;
  const cancelled = port.cancel(session.preview);
  if (!cancelled) return false;
  session.active = false;
  clearPendingAction(region, session);
  return true;
}

function inactiveAction(): ActionOutcome<ActionExecution> {
  return {
    ok: false,
    diagnostics: [diagnostic('web.action.inactive', 'This action preview is no longer active.')] as const,
  };
}

function createConfirmation(
  context: WebAppContext,
  region: WebRegion,
  port: ActionPort,
  session: ActionSession,
): () => Promise<ActionOutcome<ActionExecution>> {
  return async () => {
    if (!session.active) return inactiveAction();
    const confirmed = await port.confirm(session.preview, { signal: session.controller.signal });
    if (!confirmed.ok) {
      session.active = false;
      clearPendingAction(region, session);
      notifyAction(context, { state: 'failed', regionId: region.id, diagnostics: confirmed.diagnostics });
      return confirmed;
    }
    const executed = await port.execute(confirmed.value, { signal: session.controller.signal });
    session.active = false;
    clearPendingAction(region, session);
    if (!executed.ok) {
      notifyAction(context, { state: 'failed', regionId: region.id, diagnostics: executed.diagnostics });
      return executed;
    }
    delete region.actionAttempt;
    notifyAction(context, { state: 'executed', regionId: region.id, execution: executed.value });
    return executed;
  };
}

function actionInput(region: WebRegion, payload: ActionRequestPayload): RuntimeActionRequest['input'] {
  const input = { ...payload.input };
  for (const draft of region.drafts.values()) input[draft.field] = draft.value;
  return input;
}

function actionEntity(region: WebRegion): RuntimeActionRequest['entity'] {
  const draft = region.drafts.values().next().value;
  if (draft === undefined) return undefined;
  return { key: draft.key, revision: draft.entityRevision };
}

function previewRequest(region: WebRegion, payload: ActionRequestPayload, taskRevision: string): RuntimeActionRequest {
  const requestId = ('action-' + region.id + '-' + region.actionSequence).slice(0, 160);
  region.actionAttempt ??= ('attempt-' + region.id + '-' + taskRevision + '-' + region.actionSequence).slice(0, 160);
  const entity = actionEntity(region);
  return {
    requestId,
    action: payload.action,
    input: actionInput(region, payload),
    ...(entity === undefined ? {} : { entity }),
    idempotencyKey: region.actionAttempt,
  };
}

function actionUnavailable(context: WebAppContext, region: WebRegion): void {
  notifyAction(context, {
    state: 'failed',
    regionId: region.id,
    diagnostics: [diagnostic('web.action.unconfigured', 'This form action has no registered ActionPort.')],
  });
}

function previewFailed(
  context: WebAppContext,
  region: WebRegion,
  controller: AbortController,
  diagnostics: readonly [Diagnostic, ...Diagnostic[]],
): void {
  if (region.actionAbort === controller) {
    delete region.actionAbort;
    region.actionPending = false;
  }
  notifyAction(context, { state: 'failed', regionId: region.id, diagnostics });
}

function openPreview(
  context: WebAppContext,
  region: WebRegion,
  port: ActionPort,
  preview: ActionPreview,
  controller: AbortController,
): void {
  const session: ActionSession = { active: true, preview, controller };
  const cancel = (): boolean => cancelPreview(port, region, session);
  session.cancel = cancel;
  region.cancelAction = cancel;
  if (context.options.onActionEvent === undefined) {
    cancel();
    return;
  }
  const confirm = createConfirmation(context, region, port, session);
  notifyAction(context, { state: 'preview', regionId: region.id, preview, confirm, cancel });
}

async function previewAction(context: WebAppContext, region: WebRegion, payload: ActionRequestPayload): Promise<void> {
  const port = context.runtime.actionPort;
  if (port === undefined) {
    actionUnavailable(context, region);
    return;
  }
  if (region.actionPending) return;
  const snapshot = context.runtime.snapshot(region.id)?.region;
  if (snapshot === undefined) return;
  region.actionSequence += 1;
  const controller = new AbortController();
  region.actionAbort = controller;
  region.actionPending = true;
  const request = previewRequest(region, payload, snapshot.taskRevision);
  const preview = await port.preview(request, { signal: controller.signal });
  if (!preview.ok) {
    previewFailed(context, region, controller, preview.diagnostics);
    return;
  }
  if (controller.signal.aborted || region.actionAbort !== controller) {
    port.cancel(preview.value);
    return;
  }
  openPreview(context, region, port, preview.value, controller);
}

export function createInteractionHandler(
  context: WebAppContext,
): (region: WebRegion, request: AeliqoSemanticInteractionRequest) => Promise<void> {
  return async (region, request) => {
    if (request.payload.kind !== 'action-request') {
      saveInteraction(region, request);
      return;
    }
    await previewAction(context, region, request.payload);
  };
}
