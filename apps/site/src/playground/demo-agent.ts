import type { Intent } from '@aeliqo/core';
import type { AgentModelToolEndpoint } from '@aeliqo/agent/protocol';
import { jakartaPeopleIntent, PLAYGROUND_SCENARIOS, type ScenarioId } from './scenarios.js';

/**
 * The scripted demo agent answers only with the scenario tasks listed in the
 * connect panel. Each recognized phrase runs the same context → render tool
 * sequence an MCP client would, through the real endpoint — no model is called.
 */
export interface DemoTask {
  readonly label: string;
  intent(): Intent;
}

function normalize(value: string): string {
  return value
    .toLocaleLowerCase()
    .replaceAll(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

export function demoTasksFor(scenario: ScenarioId): readonly DemoTask[] {
  const steps = PLAYGROUND_SCENARIOS.find((candidate) => candidate.id === scenario)?.steps ?? [];
  const tasks = steps.map((step) => ({ label: step.label, intent: () => step.intent() }));
  return scenario === 'people' ? [{ label: 'People in Jakarta', intent: jakartaPeopleIntent }, ...tasks] : tasks;
}

export function matchDemoTask(value: string, scenario: ScenarioId): DemoTask | undefined {
  const phrase = normalize(value);
  if (phrase.length === 0) return undefined;
  const matches = demoTasksFor(scenario).filter((task) => {
    const label = normalize(task.label);
    return phrase === label || phrase.includes(label);
  });
  return [...matches].sort((a, b) => normalize(b.label).length - normalize(a.label).length)[0];
}

export async function runDemoTask(endpoint: AgentModelToolEndpoint, task: DemoTask, run: number): Promise<string> {
  const context = await endpoint.invoke('aeliqo_context', {}, { requestId: `demo-${run}-context` });
  if (!context.ok)
    return `The demo could not read playground context: ${context.diagnostics[0]?.message ?? 'the call was rejected.'}`;
  const rendered = await endpoint.invoke('aeliqo_render', task.intent(), {
    requestId: `demo-${run}-render`,
  });
  if (!rendered.ok) return `The demo request was rejected: ${rendered.diagnostics[0]?.message ?? 'unknown cause.'}`;
  return `The scripted demo ran context → render for “${task.label}” (${rendered.value.state}). No model was called.`;
}
