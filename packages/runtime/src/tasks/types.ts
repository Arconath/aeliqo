import type {PresentationPlan as CorePresentationPlan, ResultRef, Task} from '@aeliqo/core';

/** The only state a region owns. Records remain in the result store. */
export type PresentationPlan = CorePresentationPlan;

export interface RegionContent {
  readonly task: Task;
  readonly presentation?: PresentationPlan;
}

/** A canonical task/result dependency captured at proposal time. */
export type TaskResultReference = ResultRef;

export type RegionStatus = 'active' | 'revoked' | 'disposed';
