import type { CommitPreconditions, Intent, Outcome, PresentationPlan, Result, Task, VersionRef } from '@aeliqo/core';
import type { PresentationEnvironment } from '@aeliqo/core/presentation';
import type { AeliqoViewDefinition } from '../region/types.js';
import type { AeliqoInputBindings } from '../region/input-registry.js';

export interface RecipePresentationPolicy {
  /** Canonical representation IDs permitted by the mounted resource. */
  readonly allowedRepresentations: readonly string[];
}

export interface RecipeContext {
  readonly intent: Intent;
  readonly task: Task;
  readonly result?: Result;
  readonly inputBindings?: AeliqoInputBindings;
  readonly current: CommitPreconditions;
  readonly environment: PresentationEnvironment;
  readonly availableViews: readonly AeliqoViewDefinition[];
  /** Supplied by the app facade. Optional for source compatibility with direct recipe consumers. */
  readonly presentationPolicy?: RecipePresentationPolicy;
  readonly incumbent?: PresentationPlan;
}

export interface RecipeDefinition {
  readonly ref: VersionRef;
  readonly intents: readonly Intent['kind'][];
  build(context: RecipeContext): Outcome<PresentationPlan>;
}

export interface RecipeInput extends RecipeDefinition {}

export interface ViewInput extends AeliqoViewDefinition {}
