import type { FixtureJourney } from './fixture-journeys.js';
import type { InspectorSection } from './inspect.js';

const summaries: Record<InspectorSection, string> = {
  intent: 'The registered guided demo selected above.',
  task: 'The visible period or compiled workspace task, when available.',
  result: 'Visible synthetic result coverage and output identifiers.',
  presentation: 'The view or registered workspace pattern selected for the result.',
  diagnostics: 'Diagnostics from the current guided demo.',
};

function content(panel: HTMLElement, selector: string): string | undefined {
  return panel.querySelector<HTMLElement>(selector)?.textContent ?? undefined;
}

function dataset(panel: HTMLElement, selector: string): DOMStringMap | undefined {
  return panel.querySelector<HTMLElement>(selector)?.dataset;
}

function attendanceValue(section: InspectorSection, panel: HTMLElement, intent: string, view: string): unknown {
  switch (section) {
    case 'intent':
      return { journey: 'attendance', intent };
    case 'task':
      return { period: content(panel, '[data-testid="period"]') };
    case 'result':
      return {
        coverage: content(panel, '[data-testid="coverage"]'),
        data: content(panel, '[data-testid="daily-values"]'),
      };
    case 'presentation':
      return { view };
    case 'diagnostics':
      return { status: content(panel, '[role="status"]'), details: dataset(panel, '[role="status"]')?.diagnostic };
  }
}

function workspaceValue(section: InspectorSection, panel: HTMLElement, intent: string): unknown {
  const workspace = dataset(panel, '[data-testid="goal-workspace"]');
  switch (section) {
    case 'intent':
      return { journey: 'workspace', intent };
    case 'task':
      return { taskId: workspace?.taskId, needs: workspace?.needs };
    case 'result':
      return { outputs: workspace?.outputs, nodeResults: workspace?.nodeResults };
    case 'presentation':
      return { selectedCandidate: workspace?.selectedCandidate, planNodes: workspace?.planNodes };
    case 'diagnostics':
      return { status: content(panel, '[role="status"]') };
  }
}

const values: Readonly<
  Record<FixtureJourney, (section: InspectorSection, panel: HTMLElement, intent: string, view: string) => unknown>
> = {
  attendance: attendanceValue,
  workspace: workspaceValue,
};

export function fixtureEvidence(
  kind: FixtureJourney,
  section: InspectorSection,
  panel: HTMLElement,
  intent: string,
  view: string,
): {
  readonly summary: string;
  readonly value: unknown;
} {
  return { summary: summaries[section], value: values[kind](section, panel, intent, view) };
}
