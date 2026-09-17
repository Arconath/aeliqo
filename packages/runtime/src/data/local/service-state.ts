import type { Catalog, ResultRef } from '@aeliqo/core';
import type { LogicalPlan } from '@aeliqo/core/query';
import type { LocalDataServiceOptions, MeaningRegistration, PlanAcceptance } from '../types.js';
import { isSafePositive } from './shared.js';
import { normalizeSnapshot, normalizeSourceLimits } from './source.js';
import type { SourceLimits } from './shared.js';
import type { StoredSnapshot } from './source.js';
import type { PlanDependencies } from './query-planning.js';

const DEFAULT_PLAN_TTL_MS = 5 * 60_000;
const DEFAULT_MAX_PLANS = 256;

export interface StoredPlan {
  readonly accepted: PlanAcceptance;
  readonly logical: LogicalPlan;
  readonly dependencies: PlanDependencies;
  readonly scanEntities: readonly string[];
  readonly policyRevision?: string;
  readonly lineage: readonly { readonly output: string; readonly inputs: readonly ResultRef[] }[];
}

export interface LocalDataServiceState {
  readonly options: LocalDataServiceOptions;
  readonly sourceLimits: SourceLimits;
  readonly plans: Map<string, StoredPlan>;
  readonly registeredBundles: Map<string, MeaningRegistration>;
  readonly planTtlMs: number;
  readonly maxPlans: number;
  snapshot: StoredSnapshot;
  currentCatalog: Catalog;
}

export function createLocalDataServiceState(options: LocalDataServiceOptions): LocalDataServiceState {
  const sourceLimits = normalizeSourceLimits(options.sourceLimits);
  const snapshot = normalizeSnapshot(options.snapshot, sourceLimits);
  const planTtlMs = options.planTtlMs ?? DEFAULT_PLAN_TTL_MS;
  const maxPlans = options.maxPlans ?? DEFAULT_MAX_PLANS;
  validatePlanLimits(planTtlMs, maxPlans);
  return {
    options,
    sourceLimits,
    snapshot,
    currentCatalog: snapshot.catalog,
    plans: new Map(),
    registeredBundles: new Map(),
    planTtlMs,
    maxPlans,
  };
}

function validatePlanLimits(planTtlMs: number, maxPlans: number): void {
  if (!isSafePositive(planTtlMs) || planTtlMs > 86_400_000)
    throw new TypeError('planTtlMs must be a bounded positive duration.');
  if (!isSafePositive(maxPlans) || maxPlans > 10_000) throw new TypeError('maxPlans must be a bounded positive count.');
}

export function reapExpiredPlans(state: LocalDataServiceState, now: number): void {
  for (const [key, plan] of state.plans) {
    if (plan.accepted.expiresAt <= now) state.plans.delete(key);
  }
  while (state.plans.size >= state.maxPlans) {
    const oldest = oldestPlanKey(state.plans);
    if (oldest === undefined) return;
    state.plans.delete(oldest);
  }
}

function oldestPlanKey(plans: ReadonlyMap<string, StoredPlan>): string | undefined {
  let oldestKey: string | undefined;
  let earliestExpiry = Number.POSITIVE_INFINITY;
  for (const [key, plan] of plans) {
    if (plan.accepted.expiresAt >= earliestExpiry) continue;
    oldestKey = key;
    earliestExpiry = plan.accepted.expiresAt;
  }
  return oldestKey;
}
