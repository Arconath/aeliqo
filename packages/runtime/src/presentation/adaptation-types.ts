import type { PresentationComposition, PresentationCompositionRequest } from '@aeliqo/core/presentation';
import type {
  PresentationContext,
  PresentationEnvironment,
  PresentationRegistry,
  PresentationTargetEvidence,
} from '@aeliqo/core/presentation';
import type { RegionHandle, RegionOutcome, RegionSnapshot } from '../regions/types.js';
import type { PresentationNavigationState, PresentationRenderer } from './renderer.js';

type AdaptationContextFields = Omit<PresentationContext, 'task' | 'current' | 'incumbent' | 'environment'>;

/** Host context refreshed for each request; task and region pins are derived from the active snapshot. */
export type PresentationAdaptationContext = AdaptationContextFields &
  Partial<Pick<PresentationContext, 'environment' | 'transitionBlocked' | 'explicitTransition'>> & {
    readonly candidates?: PresentationCompositionRequest['candidates'];
    /** Optional host evidence for the core resolver; legacy region handles retain their existing fence. */
    readonly target?: PresentationTargetEvidence;
  };

export interface PresentationAdaptationReadInput {
  readonly region: RegionHandle;
  readonly snapshot: RegionSnapshot;
  readonly environment: PresentationEnvironment;
  readonly signal: AbortSignal;
}

export type PresentationAdaptationContextSource =
  | PresentationAdaptationContext
  | ((
      input: PresentationAdaptationReadInput,
    ) =>
      | PresentationAdaptationContext
      | RegionOutcome<PresentationAdaptationContext>
      | Promise<PresentationAdaptationContext | RegionOutcome<PresentationAdaptationContext>>);

export interface PresentationAdaptationOptions {
  readonly region: RegionHandle;
  readonly registry: PresentationRegistry;
  readonly baseContext: PresentationAdaptationContextSource;
  readonly readContext?: PresentationAdaptationContextSource;
  readonly renderer: PresentationRenderer;
  readonly transitionBlocked?: () => boolean;
  readonly readNavigation?: () => PresentationNavigationState | undefined;
  readonly now?: () => number;
  readonly schedule?: (callback: () => void, delayMilliseconds: number) => unknown;
  readonly cancelSchedule?: (handle: unknown) => void;
  readonly dwellMs?: number;
  readonly hysteresisPx?: number;
  readonly maxPendingRequests?: number;
}

export type PresentationAdaptationStatus = 'committed' | 'unchanged' | 'deferred' | 'cancelled';

export interface PresentationAdaptationResult {
  readonly status: PresentationAdaptationStatus;
  readonly snapshot: RegionSnapshot;
  readonly composition?: PresentationComposition;
  readonly reason?: string;
}

export interface PresentationAdaptationRequestOptions {
  readonly explicit?: boolean;
  readonly force?: boolean;
}

export interface PresentationAdaptationController {
  request(
    environment: PresentationEnvironment,
    options?: PresentationAdaptationRequestOptions,
  ): Promise<RegionOutcome<PresentationAdaptationResult>>;
  flush(): Promise<RegionOutcome<PresentationAdaptationResult>>;
  readonly pending: boolean;
  dispose(): void;
}
