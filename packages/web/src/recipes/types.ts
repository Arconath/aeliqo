import type {
  CommitPreconditions,
  Intent,
  Outcome,
  PresentationEnvironment,
  PresentationPlan,
  Result,
  Task,
  VersionRef,
} from '@aeliqo/core';
import type {AeliqoViewDefinition} from '../region/types.js';
import type {AeliqoInputBindings} from '../region/input-registry.js';

export interface RecipeContext {
  readonly intent: Intent;
  readonly task: Task;
  readonly result?: Result;
  readonly inputBindings?: AeliqoInputBindings;
  readonly current: CommitPreconditions;
  readonly environment: PresentationEnvironment;
  readonly availableViews: readonly AeliqoViewDefinition[];
  readonly incumbent?: PresentationPlan;
}

export interface RecipeDefinition {
  readonly ref: VersionRef;
  readonly intents: readonly Intent['kind'][];
  build(context: RecipeContext): Outcome<PresentationPlan>;
}

export interface RecipeInput extends RecipeDefinition {}

export interface ViewInput extends AeliqoViewDefinition {}
