import { parseIntent } from '@aeliqo/core';
import type {
  AgentCapabilityContext,
  AgentCapabilityHandlerResult,
  AgentCapabilityManifest,
  AgentJsonValue,
} from '../capabilities/types.js';
import type { RuntimeRenderReceipt } from '@aeliqo/runtime/app';
import type { AppRenderPort, AppToolEndpointOptions } from './types.js';

type RenderReceipt = Awaited<ReturnType<AppRenderPort['render']>>;

function committedReceipt(
  receipt: RenderReceipt,
): Extract<RuntimeRenderReceipt, { readonly status: 'committed' }> | undefined {
  if ('runtime' in receipt) return receipt.runtime;
  if (receipt.status === 'committed') return receipt;
  return undefined;
}

function renderValue(receipt: RenderReceipt): AgentJsonValue {
  const committed = committedReceipt(receipt);
  return {
    status: receipt.status,
    requestId: receipt.requestId,
    regionId: receipt.regionId,
    ...(committed === undefined
      ? {}
      : {
          intent: { id: committed.intent.id, kind: committed.intent.kind, resource: committed.intent.resource },
          task: { id: committed.task.id, revision: committed.task.revision, kind: committed.task.kind },
          results: committed.outputs.map((output) => summarizeOutput(output)),
        }),
    diagnostics: receipt.diagnostics.map((item) => ({
      code: item.code,
      message: item.message,
      retryable: item.retryable,
    })),
  };
}

function summarizeOutput(output: Extract<RuntimeRenderReceipt, { status: 'committed' }>['outputs'][number]) {
  const snapshot = output.handle.snapshot();
  const descriptor = snapshot.descriptor;
  if (descriptor === undefined) return { outputId: output.outputId, status: 'unavailable' };
  return {
    outputId: output.outputId,
    status: snapshot.status,
    fields: descriptor.fields.map((field) => field.id),
    loaded: descriptor.counts.loaded,
    precision: descriptor.precision.kind,
    coverage: descriptor.coverage.kind,
  };
}

function canRender(context: AgentCapabilityContext): boolean {
  return context.authority.grants.includes('task.propose') && context.authority.grants.includes('experience.commit');
}

function denied(): AgentCapabilityHandlerResult<AgentJsonValue> {
  return {
    state: 'denied',
    diagnostics: [
      {
        code: 'agent.app.denied',
        message: 'Intent compilation and presentation commit are not both permitted.',
        retryable: false,
      },
    ],
  };
}

function renderOutcome(receipt: RenderReceipt): AgentCapabilityHandlerResult<AgentJsonValue> {
  const value = renderValue(receipt);
  if (receipt.status === 'renderer-ready')
    return { state: 'renderer-ready', value, regionRevision: receipt.runtime.region.regionRevision };
  if (receipt.status === 'committed')
    return { state: 'plan-committed', value, regionRevision: receipt.region.regionRevision };
  const state = receipt.status === 'needs-input' ? 'needs-choice' : receipt.status;
  return { state, value, diagnostics: receipt.diagnostics };
}

type IntentInput = Extract<ReturnType<typeof parseIntent>, { readonly ok: true }>['value'];

export function createRenderCapability(
  options: AppToolEndpointOptions,
  renderPort: AppRenderPort,
): AgentCapabilityManifest<IntentInput, AgentJsonValue> {
  return {
    ref: { id: 'aeliqo.app.render', revision: '1' },
    operation: 'task.evaluate',
    label: 'Render a registered Aeliqo intent',
    description:
      'Validates and renders an intent through the same compiler, data, authority, adaptive policy, and Region lifecycle used by application code.',
    parse: parseIntent,
    async invoke(intent, context): Promise<AgentCapabilityHandlerResult<AgentJsonValue>> {
      if (!canRender(context)) return denied();
      const receipt = await renderPort.render({ regionId: options.regionId, intent, signal: context.signal });
      return renderOutcome(receipt);
    },
  };
}
