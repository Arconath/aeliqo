import type { RegionCommitAuthorizationInput, RegionOutcome } from './types.js';
import type { AuthorizeRegionCommit } from './types.js';
import { FAILURE, failure, normalizeHostOutcome } from './region-contracts.js';

export interface CommitDeadlineOptions {
  readonly input: Omit<RegionCommitAuthorizationInput, 'signal'>;
  readonly callerSignal: AbortSignal | undefined;
  readonly maxMilliseconds: number;
  readonly authorize: AuthorizeRegionCommit;
  readonly isLive: () => boolean;
  readonly closedOutcome: () => RegionOutcome<void>;
  readonly controllers: Set<AbortController>;
}

export function authorizeWithDeadline({
  input,
  callerSignal,
  maxMilliseconds,
  authorize,
  isLive,
  closedOutcome,
  controllers,
}: CommitDeadlineOptions): Promise<RegionOutcome<void>> {
  if (!isLive()) return Promise.resolve(closedOutcome());
  if (callerSignal?.aborted) return Promise.resolve(cancelled());

  const controller = new AbortController();
  controllers.add(controller);
  let timedOut = false;
  let settled = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let resolveResult: (result: RegionOutcome<void>) => void = () => {};
  const finish = (result: RegionOutcome<void>): void => {
    if (settled) return;
    settled = true;
    if (timer !== undefined) clearTimeout(timer);
    controller.signal.removeEventListener('abort', onAbort);
    callerSignal?.removeEventListener('abort', onCallerAbort);
    controllers.delete(controller);
    resolveResult(result);
  };
  const onAbort = (): void => {
    if (!isLive()) finish(closedOutcome());
    else if (callerSignal?.aborted) finish(cancelled());
    else if (timedOut) finish(failure('runtime.region-budget', FAILURE.authorizationTimeout));
    else finish(closedOutcome());
  };
  const onCallerAbort = (): void => controller.abort();
  const result = new Promise<RegionOutcome<void>>((resolve) => {
    resolveResult = resolve;
  });
  controller.signal.addEventListener('abort', onAbort, { once: true });
  callerSignal?.addEventListener('abort', onCallerAbort, { once: true });
  if (callerSignal?.aborted) {
    onCallerAbort();
    return result;
  }
  timer = setTimeout(
    () => {
      timedOut = true;
      controller.abort();
    },
    Math.min(maxMilliseconds, 2_147_483_647),
  );
  let pending: Promise<RegionOutcome<void>>;
  try {
    pending = Promise.resolve(authorize({ ...input, signal: controller.signal }));
  } catch {
    finish(failure('runtime.region-denied', FAILURE.denied));
    return result;
  }
  pending.then(
    (authorized) => {
      if (!settled) settleAuthorization(authorized, { isLive, callerSignal, finish, closedOutcome });
    },
    () => finish(failure('runtime.region-denied', FAILURE.denied)),
  );
  return result;
}

function cancelled(): RegionOutcome<void> {
  return failure('runtime.region-cancelled', 'The region commit was cancelled before publication.');
}

function settleAuthorization(
  authorized: unknown,
  options: Pick<CommitDeadlineOptions, 'isLive' | 'callerSignal' | 'closedOutcome'> & {
    readonly finish: (result: RegionOutcome<void>) => void;
  },
): void {
  try {
    if (!options.isLive()) {
      options.finish(options.closedOutcome());
      return;
    }
    const normalized = normalizeHostOutcome<void>(authorized);
    if (!options.isLive()) options.finish(options.closedOutcome());
    else if (options.callerSignal?.aborted) options.finish(cancelled());
    else options.finish(normalized);
  } catch {
    options.finish(failure('runtime.region-denied', FAILURE.denied));
  }
}
