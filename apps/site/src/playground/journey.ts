type JourneyStageState = 'pending' | 'active' | 'done' | 'failed';
type JourneyStages = readonly [JourneyStageState, JourneyStageState, JourneyStageState];

const READY_STAGES: JourneyStages = ['done', 'done', 'done'];
const EVALUATING_STAGES: JourneyStages = ['done', 'active', 'pending'];
const FAILED_STAGES: JourneyStages = ['done', 'failed', 'pending'];

export function journeyStagesFor(receipt: string): JourneyStages {
  if (receipt === 'renderer-ready') return READY_STAGES;
  if (receipt === 'pending' || receipt.startsWith('needs-input:')) return EVALUATING_STAGES;
  return FAILED_STAGES;
}

export function createJourneyTracker(stages: NodeListOf<HTMLElement>, viewBadge: HTMLElement) {
  return {
    set(intent: JourneyStageState, result: JourneyStageState, view: JourneyStageState): void {
      const states = [intent, result, view];
      stages.forEach((item, index) => {
        item.dataset.state = states[index] ?? 'pending';
      });
      viewBadge.dataset.state = view === 'done' ? 'ready' : 'pending';
    },
  };
}
