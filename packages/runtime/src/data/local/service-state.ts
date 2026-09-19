import type { Catalog, Outcome, ResultRef } from '@aeliqo/core';
import type { LogicalPlan } from '@aeliqo/core/query';
import type { LocalDataServiceOptions, LocalSnapshot, MeaningRegistration, PlanAcceptance } from '../types.js';
import { canonical, isSafePositive } from './shared.js';
import { normalizeSnapshot, normalizeSourceLimits } from './source.js';
import type { SourceLimits } from './shared.js';
import type { StoredSnapshot } from './source.js';
import type { PlanDependencies } from './query-planning.js';

const DEFAULT_PLAN_TTL_MS = 5 * 60_000;
const DEFAULT_MAX_PLANS = 256;
const DEFAULT_MAX_SOURCE_REVISIONS = 256;

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
  readonly maxSourceRevisions: number;
  readonly revisionHistory: Set<string>;
  readonly snapshotValidator?: (snapshot: LocalSnapshot) => Outcome<void>;
  readonly rejectExecutableToJSON: boolean;
  snapshot: StoredSnapshot;
  currentCatalog: Catalog;
  readonly fixedCatalog?: Catalog;
}

export function createLocalDataServiceState(
  options: LocalDataServiceOptions,
  fixedCatalogInput?: Catalog,
  snapshotValidator?: (snapshot: LocalSnapshot) => Outcome<void>,
  rejectExecutableToJSON = false,
): LocalDataServiceState {
  const sourceLimits = normalizeSourceLimits(options.sourceLimits);
  const snapshot = normalizeSnapshot(options.snapshot, sourceLimits, { rejectExecutableToJSON });
  const fixedCatalog = normalizeFixedCatalog(fixedCatalogInput, snapshot.catalog);
  const planTtlMs = options.planTtlMs ?? DEFAULT_PLAN_TTL_MS;
  const maxPlans = options.maxPlans ?? DEFAULT_MAX_PLANS;
  const maxSourceRevisions = options.maxSourceRevisions ?? DEFAULT_MAX_SOURCE_REVISIONS;
  validatePlanLimits(planTtlMs, maxPlans, maxSourceRevisions);
  return {
    options,
    sourceLimits,
    snapshot,
    currentCatalog: snapshot.catalog,
    ...(fixedCatalog === undefined ? {} : { fixedCatalog }),
    plans: new Map(),
    registeredBundles: new Map(),
    planTtlMs,
    maxPlans,
    maxSourceRevisions,
    revisionHistory: new Set([snapshot.sourceRevision]),
    ...(snapshotValidator === undefined ? {} : { snapshotValidator }),
    rejectExecutableToJSON,
  };
}

function normalizeFixedCatalog(input: Catalog | undefined, snapshot: Catalog): Catalog | undefined {
  if (input === undefined) return undefined;
  if (canonical(input) !== canonical(snapshot))
    throw new TypeError('fixedCatalog must match the initial local snapshot catalog.');
  return snapshot;
}

function validatePlanLimits(planTtlMs: number, maxPlans: number, maxSourceRevisions: number): void {
  if (!isSafePositive(planTtlMs) || planTtlMs > 86_400_000)
    throw new TypeError('planTtlMs must be a bounded positive duration.');
  if (!isSafePositive(maxPlans) || maxPlans > 10_000) throw new TypeError('maxPlans must be a bounded positive count.');
  if (!isSafePositive(maxSourceRevisions) || maxSourceRevisions > 10_000)
    throw new TypeError('maxSourceRevisions must be a bounded positive count.');
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
