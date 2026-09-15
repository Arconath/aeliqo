import type {Intent} from '@aeliqo/core';
import type {WebRenderReceipt} from '@aeliqo/web/app';

export type InspectorSection = 'intent' | 'task' | 'result' | 'presentation' | 'diagnostics';

export interface PlaygroundEvidence {
  readonly intent?: Intent;
  readonly receipt?: WebRenderReceipt;
}

export function evidenceFor(evidence: PlaygroundEvidence, section: InspectorSection): {readonly summary: string; readonly value: unknown} {
  const receipt = evidence.receipt;
  if (section === 'intent') return {summary: 'The exact bounded request sent by guided controls, application code, or an agent tool.', value: evidence.intent ?? {}};
  if (section === 'diagnostics') return {summary: 'Actionable runtime diagnostics. Empty means no diagnostic was emitted for the last request.', value: receipt?.diagnostics ?? []};
  if (receipt === undefined) return {summary: 'Run an intent to inspect this stage.', value: {}};
  if (section === 'task') {
    const task = 'runtime' in receipt ? receipt.runtime.task : 'task' in receipt ? receipt.task : undefined;
    return {summary: 'The compiler output after resource, field, operation, and view validation.', value: task ?? {}};
  }
  if (section === 'result') {
    const outputs = 'runtime' in receipt ? receipt.runtime.outputs : [];
    return {summary: 'Result descriptors and evidence only. Private records are intentionally omitted from the inspector.', value: outputs.map((output) => output.handle.snapshot().descriptor ?? {status: output.handle.snapshot().status})};
  }
  if ('presentation' in receipt) {
    const root = receipt.presentation.nodes.find((node) => node.node.id === receipt.presentation.plan.rootId);
    return {summary: 'The selected registered view, environment, and validated plan. This is policy evidence, not model reasoning.',
      value: {selectedView: root?.manifest.id, environment: receipt.environment, plan: receipt.presentation.plan}};
  }
  return {summary: 'No presentation committed for the last request.', value: {status: receipt.status}};
}
