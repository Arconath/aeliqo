export type FixtureJourney = 'attendance' | 'workspace';

export function fixtureStatus(kind: FixtureJourney, receipt: string, title: string) {
  if (receipt.startsWith('renderer-ready'))
    return {
      receipt: 'renderer-ready',
      result: 'Evaluated',
      view: kind === 'attendance' ? 'Trend' : 'Workspace',
      status: `${title} is ready.`,
    };
  if (receipt.startsWith('Loading'))
    return {
      receipt: 'pending',
      result: 'Evaluating…',
      view: 'Waiting',
      status: 'Evaluating the registered synthetic journey…',
    };
  if (receipt.startsWith('needs-input:'))
    return { receipt, result: 'Needs a choice', view: 'Choose a metric', status: receipt };
  return { receipt, result: 'Could not complete', view: 'No new view', status: receipt || 'Journey failed.' };
}

interface FixtureJourneyOptions {
  readonly attendancePanel: HTMLElement;
  readonly workspacePanel: HTMLElement;
  readonly onStatus: (kind: FixtureJourney, receipt: string) => void;
  readonly onError: () => void;
}

export function createFixtureJourneys(options: FixtureJourneyOptions) {
  const loaded = new Set<FixtureJourney>();
  let active: FixtureJourney | undefined;
  let observer: MutationObserver | undefined;

  function hide(): void {
    observer?.disconnect();
    observer = undefined;
    active = undefined;
    options.attendancePanel.hidden = true;
    options.workspacePanel.hidden = true;
  }

  async function show(kind: FixtureJourney): Promise<void> {
    hide();
    active = kind;
    const panel = kind === 'attendance' ? options.attendancePanel : options.workspacePanel;
    panel.hidden = false;
    try {
      if (kind === 'attendance') {
        const fixture = await import('../../../../examples/vnext/attendance/main.js');
        if (loaded.has(kind) && active === kind) fixture.restartAttendanceJourney();
      } else {
        const fixture = await import('../../../../examples/vnext/workspace-goal/main.js');
        if (loaded.has(kind) && active === kind) fixture.restartWorkspaceGoalJourney();
      }
      loaded.add(kind);
      if (active !== kind) return;
      const fixtureStatus = panel.querySelector<HTMLElement>('[role="status"]');
      if (fixtureStatus === null) throw new Error('The journey status is unavailable.');
      const syncStatus = () => {
        if (active === kind) options.onStatus(kind, fixtureStatus.textContent ?? '');
      };
      observer = new MutationObserver(syncStatus);
      observer.observe(fixtureStatus, { childList: true, characterData: true, subtree: true });
      syncStatus();
    } catch {
      if (active === kind) options.onError();
    }
  }

  return { hide, show };
}
