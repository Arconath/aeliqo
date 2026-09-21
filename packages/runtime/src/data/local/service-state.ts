import type { Catalog, Outcome, ResultRef } from '@aeliqo/core';
import type { LogicalPlan } from '@aeliqo/core/query';
import type { LocalDataServiceOptions, LocalSnapshot, MeaningRegistration, PlanAcceptance } from '../types.js';
import type { CursorStore } from './cursor.js';
import { canonical, isSafePositive } from './shared.js';
import { normalizeSnapshot, normalizeSourceLimits } from './source.js';
import type { SourceLimits } from './shared.js';
import type { StoredSnapshot } from './source.js';
import type { PlanDependencies } from './query-planning.js';

const DEFAULT_PLAN_TTL_MS = 5 * 60_000;
const DEFAULT_MAX_PLANS = 256;
const DEFAULT_MAX_CURSORS = 1024;
const DEFAULT_MAX_SOURCE_REVISIONS = 256;

export interface StoredPlan {
  readonly accepted: PlanAcceptance;
  readonly cursorExpiresAt: number;
  readonly cursorPartition: string;
  readonly cursorOffset?: number;
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
  readonly cursorTtlMs: number;
  readonly now: () => number;
  readonly workNow: () => number;
  readonly cursorStore: CursorStore;
  readonly maxCursors: number;
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
  const cursorTtlMs = options.cursorTtlMs ?? planTtlMs;
  const now = options.now ?? (() => Date.now());
  const workNow = options.workNow ?? monotonicNow;
  const maxPlans = options.maxPlans ?? DEFAULT_MAX_PLANS;
  const maxCursors = options.maxCursors ?? DEFAULT_MAX_CURSORS;
  const maxSourceRevisions = options.maxSourceRevisions ?? DEFAULT_MAX_SOURCE_REVISIONS;
  validatePlanLimits(planTtlMs, cursorTtlMs, maxPlans, maxCursors, maxSourceRevisions, now, workNow);
  return {
    options,
    sourceLimits,
    snapshot,
    currentCatalog: snapshot.catalog,
    ...(fixedCatalog === undefined ? {} : { fixedCatalog }),
    plans: new Map(),
    registeredBundles: new Map(),
    planTtlMs,
    cursorTtlMs,
    now,
    workNow,
    cursorStore: new Map(),
    maxCursors,
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

function validatePlanLimits(
  planTtlMs: number,
  cursorTtlMs: number,
  maxPlans: number,
  maxCursors: number,
  maxSourceRevisions: number,
  now: () => number,
  workNow: () => number,
): void {
  validateBoundedPositive(planTtlMs, 86_400_000, 'planTtlMs must be a bounded positive duration.');
  validateBoundedPositive(cursorTtlMs, 86_400_000, 'cursorTtlMs must be a bounded positive duration.');
  if (typeof now !== 'function') throw new TypeError('now must be a host clock function.');
  if (typeof workNow !== 'function') throw new TypeError('workNow must be a host monotonic clock function.');
  validateBoundedPositive(maxPlans, 10_000, 'maxPlans must be a bounded positive count.');
  validateBoundedPositive(maxCursors, 100_000, 'maxCursors must be a bounded positive count.');
  validateBoundedPositive(maxSourceRevisions, 10_000, 'maxSourceRevisions must be a bounded positive count.');
}

function validateBoundedPositive(value: number, maximum: number, message: string): void {
  if (!isSafePositive(value) || value > maximum) throw new TypeError(message);
}

function monotonicNow(): number {
  const clock = globalThis.performance?.now;
  return typeof clock === 'function' ? clock.call(globalThis.performance) : Date.now();
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
