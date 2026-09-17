import type { RegionDocument } from '../persistence/types.js';
import type { RegionAuthority, RegionOutcome, RegionRestoreMaterialization, RestoreRegion } from './types.js';
import { FAILURE, normalizeHostOutcome, failure } from './region-contracts.js';
import { validateRestoreMaterialization } from './result-handles.js';

export interface RestoreDeadlineOptions {
  readonly document: RegionDocument;
  readonly authority: RegionAuthority;
  readonly maxRestoreMilliseconds: number;
  readonly restoreRegion: RestoreRegion | undefined;
  readonly isCurrent: () => boolean;
  readonly controllers: Set<AbortController>;
}

export function restoreWithDeadline({
  document,
  authority,
  maxRestoreMilliseconds,
  restoreRegion,
  isCurrent,
  controllers,
}: RestoreDeadlineOptions): Promise<RegionOutcome<RegionRestoreMaterialization>> {
  if (restoreRegion === undefined)
    return Promise.resolve(failure('runtime.region-denied', 'Restoring a region requires a host requery callback.'));
  if (!isCurrent()) return Promise.resolve(failure('runtime.region-disposed', FAILURE.disposed));

  const controller = new AbortController();
  controllers.add(controller);
  let timedOut = false;
  let settled = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let resolveResult: (result: RegionOutcome<RegionRestoreMaterialization>) => void = () => {};
  const finish = (result: RegionOutcome<RegionRestoreMaterialization>): void => {
    if (settled) return;
    settled = true;
    if (timer !== undefined) clearTimeout(timer);
    controller.signal.removeEventListener('abort', onAbort);
    controllers.delete(controller);
    resolveResult(result);
  };
  const onAbort = (): void => {
    const outcome: RegionOutcome<RegionRestoreMaterialization> = timedOut
      ? failure<RegionRestoreMaterialization>(
          'runtime.region-budget',
          'The host restore/requery exceeded its bounded time budget.',
        )
      : failure<RegionRestoreMaterialization>('runtime.region-disposed', FAILURE.disposed);
    finish(outcome);
  };
  const result = new Promise<RegionOutcome<RegionRestoreMaterialization>>((resolve) => {
    resolveResult = resolve;
  });
  controller.signal.addEventListener('abort', onAbort, { once: true });
  timer = setTimeout(
    () => {
      timedOut = true;
      controller.abort();
    },
    Math.min(maxRestoreMilliseconds, 2_147_483_647),
  );

  let pending: Promise<RegionOutcome<RegionRestoreMaterialization>>;
  try {
    pending = Promise.resolve(restoreRegion({ regionId: document.id, document, authority, signal: controller.signal }));
  } catch {
    finish(failure('runtime.region-denied', FAILURE.denied));
    return result;
  }
  pending.then(
    (value) => {
      if (!settled) settleRestore(value, { isCurrent, finish });
    },
    () => finish(failure('runtime.region-denied', FAILURE.denied)),
  );
  return result;
}

function settleRestore(
  value: unknown,
  options: {
    readonly isCurrent: () => boolean;
    readonly finish: (result: RegionOutcome<RegionRestoreMaterialization>) => void;
  },
): void {
  try {
    const { isCurrent, finish } = options;
    if (!isCurrent()) {
      finish(failure('runtime.region-disposed', FAILURE.disposed));
      return;
    }
    const normalized = normalizeHostOutcome<RegionRestoreMaterialization>(value);
    if (!isCurrent()) {
      finish(failure('runtime.region-disposed', FAILURE.disposed));
      return;
    }
    if (!normalized.ok) {
      finish(normalized);
      return;
    }
    finish(validateRestoreMaterialization(normalized.value));
  } catch {
    options.finish(failure('runtime.region-denied', FAILURE.denied));
  }
}
