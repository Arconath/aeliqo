import type { Result } from '@aeliqo/core';
import type { RuntimeCommittedReceipt } from '@aeliqo/runtime/app';
import type { AeliqoRegionResult } from '../region/types.js';
import type { AeliqoInputBindings } from '../region/input-registry.js';
import type { WebRenderReceipt } from './types.js';
import { diagnostic, failedAfterRuntime, type WebAppContext, type WebRegion } from './context.js';
import { beginPresentation, presentationCurrent } from './presentation-operation.js';
import { preparePresentation } from './presentation-plan.js';
import { prepareRenderer } from './presentation-renderer.js';
import { retainAppInteraction } from './interaction-projection.js';

export async function present(
  context: WebAppContext,
  region: WebRegion,
  receipt: RuntimeCommittedReceipt,
  results: readonly AeliqoRegionResult[],
  descriptors: readonly Result[],
  requestId: string,
  expectedSequence: number,
  inputs?: AeliqoInputBindings,
  signal?: AbortSignal,
): Promise<WebRenderReceipt> {
  const operation = beginPresentation(region, signal);
  const active = () => presentationCurrent(region, expectedSequence, operation);
  const cancelled = () =>
    failedAfterRuntime('cancelled', receipt, requestId, [
      diagnostic('web.app.cancelled', 'A newer web operation replaced this presentation.'),
    ]);
  let closeRenderer = () => {};
  try {
    if (!active()) return cancelled();
    const prepared = preparePresentation(
      context,
      region,
      receipt,
      results,
      descriptors,
      requestId,
      expectedSequence,
      inputs,
    );
    if (!prepared.ok) return failedAfterRuntime(prepared.status, receipt, requestId, prepared.diagnostics);
    const renderer = prepareRenderer(context, region, prepared.value, results, active);
    closeRenderer = renderer.close;
    const committed = await context.runtime.commitPresentation({
      regionId: region.id,
      requestId,
      task: receipt.task,
      presentation: prepared.value.presentation.plan,
      interaction: renderer.projection.interaction ?? { version: '1', values: [], drafts: [] },
      projection: renderer.projection,
      signal: operation.signal,
    });
    if (!committed.ok) {
      const code = committed.diagnostics[0]?.code ?? '';
      const status = cancelledCommit(active(), code) ? 'cancelled' : 'failed';
      return failedAfterRuntime(status, receipt, requestId, committed.diagnostics);
    }
    const presentation = renderer.applied();
    const task = committed.value.state?.task;
    if (!active() || presentation === undefined || task === undefined) return cancelled();
    retainAppInteraction(region, region.element.interaction);
    return {
      status: 'renderer-ready',
      requestId,
      regionId: region.id,
      runtime: { ...receipt, task, region: committed.value },
      presentation,
      environment: prepared.value.environment,
      diagnostics: [],
    };
  } finally {
    try {
      closeRenderer();
    } finally {
      operation.close();
    }
  }
}

function cancelledCommit(active: boolean, code: string): boolean {
  return !active || /stale|cancelled/u.test(code);
}
