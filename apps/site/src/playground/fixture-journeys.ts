export type FixtureJourney = 'attendance' | 'workspace';

export interface FixtureJourneySpec {
  readonly intentLabel: string;
  readonly title: string;
  readonly definition: string;
  readonly view: string;
  readonly load: () => Promise<{ readonly restart: () => void }>;
}

export const FIXTURE_JOURNEYS: Readonly<Record<FixtureJourney, FixtureJourneySpec>> = {
  attendance: {
    intentLabel: 'Analyze daily attendance',
    title: 'Daily attendance',
    definition: 'Approved rate: present eligible employee-days / eligible employee-days. September 2026, Asia/Jakarta.',
    view: 'Trend',
    load: async () => {
      const fixture = await import('../../../../examples/vnext/attendance/main.js');
      return { restart: () => fixture.restartAttendanceJourney() };
    },
  },
  workspace: {
    intentLabel: 'Engineering attendance overview',
    title: 'Analytical workspace',
    definition: 'One registered goal with summary, daily trend, and employee breakdown in a single Region.',
    view: 'Workspace',
    load: async () => {
      const fixture = await import('../../../../examples/vnext/workspace-goal/main.js');
      return { restart: () => fixture.restartWorkspaceGoalJourney() };
    },
  },
};

interface FixtureStatus {
  readonly receipt: string;
  readonly result: string;
  readonly view: string;
  readonly status: string;
}

const STATUS_RULES: ReadonlyArray<
  readonly [
    test: (receipt: string) => boolean,
    build: (kind: FixtureJourney, receipt: string, title: string) => FixtureStatus,
  ]
> = [
  [
    (receipt) => receipt.startsWith('renderer-ready'),
    (kind, _receipt, title) => ({
      receipt: 'renderer-ready',
      result: 'Evaluated',
      view: FIXTURE_JOURNEYS[kind].view,
      status: `${title} is ready.`,
    }),
  ],
  [
    (receipt) => receipt.startsWith('Loading'),
    () => ({
      receipt: 'pending',
      result: 'Evaluating…',
      view: 'Waiting',
      status: 'Evaluating the registered guided demo…',
    }),
  ],
  [
    (receipt) => receipt.startsWith('needs-input:'),
    (_kind, receipt) => ({ receipt, result: 'Needs a choice', view: 'Choose a metric', status: receipt }),
  ],
];

export function fixtureStatus(kind: FixtureJourney, receipt: string, title: string): FixtureStatus {
  const rule = STATUS_RULES.find(([test]) => test(receipt));
  if (rule !== undefined) return rule[1](kind, receipt, title);
  return { receipt, result: 'Could not complete', view: 'No new view', status: receipt || 'The demo failed.' };
}

interface FixtureJourneyOptions {
  readonly attendancePanel: HTMLElement;
  readonly workspacePanel: HTMLElement;
  readonly onStatus: (kind: FixtureJourney, receipt: string) => void;
  readonly onError: () => void;
}

export function createFixtureJourneys(options: FixtureJourneyOptions) {
  const panels: Record<FixtureJourney, HTMLElement> = {
    attendance: options.attendancePanel,
    workspace: options.workspacePanel,
  };
  const loaded = new Set<FixtureJourney>();
  let active: FixtureJourney | undefined;
  let observer: MutationObserver | undefined;

  function hide(): void {
    observer?.disconnect();
    observer = undefined;
    active = undefined;
    panels.attendance.hidden = true;
    panels.workspace.hidden = true;
  }

  async function show(kind: FixtureJourney): Promise<void> {
    hide();
    active = kind;
    const panel = panels[kind];
    panel.hidden = false;
    try {
      const fixture = await FIXTURE_JOURNEYS[kind].load();
      if (loaded.has(kind) && active === kind) fixture.restart();
      loaded.add(kind);
      if (active !== kind) return;
      const fixtureStatus = panel.querySelector<HTMLElement>('[role="status"]');
      if (fixtureStatus === null) throw new Error('The demo status element is unavailable.');
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
