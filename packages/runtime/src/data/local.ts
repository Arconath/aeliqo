import type { Catalog, Outcome } from '@aeliqo/core';
import type { DataService, LocalDataService, LocalDataServiceOptions } from './types.js';
import { describeLocalData } from './local/describe.js';
import { executeLocalData } from './local/execute.js';
import {
  registerMeaningBundle as registerMeaningBundleWithState,
  replaceLocalSnapshot,
} from './local/meaning-registration.js';
import { planLocalData } from './local/plan.js';
import { createLocalDataServiceState } from './local/service-state.js';
import { DEFAULT_BUDGET } from './local/budget.js';
import { DEFAULT_SOURCE_LIMITS } from './local/source.js';

export type SourceRevisionPin =
  { readonly kind: 'absent' } | { readonly kind: 'current'; readonly value: string } | { readonly kind: 'invalid' };

const LOCAL_DATA_SERVICE_READERS = new WeakMap<object, () => unknown>();

export function brandLocalDataService<T extends object>(service: T, readRevision: () => unknown): T {
  LOCAL_DATA_SERVICE_READERS.set(service, readRevision);
  return service;
}

export function readSourceRevisionPin(data: DataService): SourceRevisionPin {
  const read = data !== null && typeof data === 'object' ? LOCAL_DATA_SERVICE_READERS.get(data) : undefined;
  if (read === undefined) return { kind: 'absent' };
  try {
    const value = read();
    return typeof value === 'string' && value.length > 0 ? { kind: 'current', value } : { kind: 'invalid' };
  } catch {
    return { kind: 'invalid' };
  }
}

export function createLocalDataService(options: LocalDataServiceOptions): LocalDataService {
  return createService(createLocalDataServiceState(options));
}

export function createFeatureLocalDataService(
  options: LocalDataServiceOptions,
  fixedCatalog: Catalog,
  snapshotValidator?: (snapshot: LocalDataServiceOptions['snapshot']) => Outcome<void>,
): LocalDataService {
  return createService(createLocalDataServiceState(options, fixedCatalog, snapshotValidator, true));
}

function createService(state: ReturnType<typeof createLocalDataServiceState>): LocalDataService {
  const service: LocalDataService = {
    ...(state.options.cohortResolver === undefined ? {} : { cohortResolver: state.options.cohortResolver }),
    get catalog() {
      return state.currentCatalog;
    },
    get sourceRevision() {
      return state.snapshot.sourceRevision;
    },
    describe: (request, context = {}) => describeLocalData(state, request, context),
    plan: (request, context = {}) => planLocalData(state, request, context),
    execute: (request, context = {}) => executeLocalData(state, request, context),
    replaceSnapshot: (snapshot) => replaceLocalSnapshot(state, snapshot),
    registerMeaningBundle: (bundle) => registerMeaningBundleWithState(state, bundle),
  };
  return brandLocalDataService(service, () => state.snapshot.sourceRevision);
}

export { DEFAULT_BUDGET, DEFAULT_SOURCE_LIMITS };
