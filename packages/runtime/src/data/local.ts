import type { LocalDataService, LocalDataServiceOptions } from './types.js';
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

export function createLocalDataService(options: LocalDataServiceOptions): LocalDataService {
  const state = createLocalDataServiceState(options);
  return {
    ...(options.cohortResolver === undefined ? {} : { cohortResolver: options.cohortResolver }),
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
}

export { DEFAULT_BUDGET, DEFAULT_SOURCE_LIMITS };
