import type { RuntimeCommittedReceipt } from '@aeliqo/runtime/app';
import { cancelActiveAction } from './interaction.js';
import {
  diagnostic,
  failedAfterRuntime,
  interactionLocked,
  materialize,
  type WebAppContext,
  type WebRegion,
} from './context.js';
import { present } from './presentation.js';
import { resolveFormBindings } from './form-state.js';
import { cancelPendingPresentation } from './presentation-operation.js';
import type { WebRenderInput, WebRenderReceipt } from './types.js';

function cancelledRender(receipt: RuntimeCommittedReceipt, message: string): WebRenderReceipt {
  return failedAfterRuntime('cancelled', receipt, receipt.requestId, [diagnostic('web.app.cancelled', message)]);
}

function materializationFailure(receipt: RuntimeCommittedReceipt): WebRenderReceipt {
  return failedAfterRuntime('failed', receipt, receipt.requestId, [
    diagnostic('web.app.materialization', 'The committed Result is unavailable to the renderer.'),
  ]);
}

function formFailure(receipt: RuntimeCommittedReceipt, diagnostics: Parameters<typeof failedAfterRuntime>[3]) {
  const status = receipt.intent.kind === 'edit' ? 'needs-input' : 'failed';
  return failedAfterRuntime(status, receipt, receipt.requestId, diagnostics);
}

async function presentCommitted(
  context: WebAppContext,
  region: WebRegion,
  receipt: RuntimeCommittedReceipt,
  sequence: number,
  input: WebRenderInput,
): Promise<WebRenderReceipt> {
  if (sequence !== region.sequence) return cancelledRender(receipt, 'A newer web render replaced this request.');
  cancelActiveAction(region);
  const bound = materialize(receipt);
  if (bound === undefined) return materializationFailure(receipt);
  const form = await resolveFormBindings(context, region, receipt, input.signal);
  if (!form.ok) return formFailure(receipt, form.diagnostics);
  if (sequence !== region.sequence) return cancelledRender(receipt, 'A newer web render replaced form state loading.');
  const result = await present(
    context,
    region,
    receipt,
    bound.results,
    bound.descriptors,
    ('present-' + receipt.requestId).slice(0, 160),
    sequence,
    form.value,
    input.signal,
  );
  if (result.status === 'renderer-ready' && sequence === region.sequence) {
    region.last = { receipt: result.runtime, ...bound, ...(form.value === undefined ? {} : { inputs: form.value }) };
    if (region.pendingAdapt) return (await adaptRegion(context, region)) ?? result;
  }
  return result;
}

function missingRegion(input: WebRenderInput): WebRenderReceipt {
  return {
    status: 'failed',
    regionId: input.regionId,
    requestId: 'render-' + input.regionId,
    diagnostics: [diagnostic('web.app.mount', 'Mount the Region before rendering.')],
  };
}

export async function renderRequest(context: WebAppContext, input: WebRenderInput): Promise<WebRenderReceipt> {
  const region = context.regions.get(input.regionId);
  if (region === undefined) return missingRegion(input);
  const sequence = ++region.sequence;
  cancelPendingPresentation(region);
  const receipt = await context.runtime.render(input);
  if (receipt.status !== 'committed') {
    if (receipt.status === 'denied') region.element.revoke();
    return receipt;
  }
  return presentCommitted(context, region, receipt, sequence, input);
}

export async function adaptRegion(context: WebAppContext, region: WebRegion): Promise<WebRenderReceipt | undefined> {
  if (context.disposed || context.regions.get(region.id) !== region) return undefined;
  if (region.last === undefined || interactionLocked(region)) {
    region.pendingAdapt = true;
    return undefined;
  }
  region.pendingAdapt = false;
  const requestId = ('adapt-' + region.id + '-' + ++region.sequence).slice(0, 160);
  cancelPendingPresentation(region);
  const result = await present(
    context,
    region,
    region.last.receipt,
    region.last.results,
    region.last.descriptors,
    requestId,
    region.sequence,
    region.last.inputs,
  );
  if (result.status === 'renderer-ready') region.last = { ...region.last, receipt: result.runtime };
  return result;
}
