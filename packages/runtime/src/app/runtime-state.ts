import { WIRE_LIMITS } from '@aeliqo/core';
import type { Diagnostic, Outcome, ResultRef } from '@aeliqo/core';
import type { RuntimeRegionState, RuntimeRenderStatus } from './types.js';

export interface MountedRegion {
  readonly regionId: string;
  readonly resourceId: string;
  readonly listeners: Set<(state: RuntimeRegionState) => void>;
  state: RuntimeRegionState;
  sequence: number;
  active?: AbortController;
  principalKey?: string;
  refs: readonly ResultRef[];
  pendingRefs: readonly ResultRef[];
}

export function diagnostic(code: string, message: string, path?: readonly (string | number)[]): Diagnostic {
  return { code, message, retryable: false, ...(path === undefined ? {} : { path }) };
}

export function failure<T = never>(code: string, message: string, path?: readonly (string | number)[]): Outcome<T> {
  return { ok: false, diagnostics: [diagnostic(code, message, path)] };
}

export function validId(value: string): boolean {
  return value.length > 0 && value.length <= WIRE_LIMITS.id && !/[\s\u0000-\u001f\u007f]/u.test(value);
}

export function refKey(ref: ResultRef): string {
  return JSON.stringify([ref.id, ref.revision, ref.outputId, ref.queryDigest, ref.scopeDigest]);
}

export function uniqueRefs(refs: readonly ResultRef[]): readonly ResultRef[] {
  return Object.freeze([...new Map(refs.map((ref) => [refKey(ref), ref])).values()]);
}

export function statusFor(diagnostics: readonly Diagnostic[]): Exclude<RuntimeRenderStatus, 'committed'> {
  const code = diagnostics[0]?.code ?? '';
  if (matchesAny(code, ['cancel', 'abort', 'disposed', 'stale'])) return 'cancelled';
  if (matchesAny(code, ['denied', 'revoked', 'permission'])) return 'denied';
  if (matchesAny(code, ['unsupported']) || code.startsWith('intent.unknown-')) return 'unsupported';
  if (matchesAny(code, ['needs-choice', 'needs-input', 'identity'])) return 'needs-input';
  return 'failed';
}

function matchesAny(value: string, terms: readonly string[]): boolean {
  return terms.some((term) => value.includes(term));
}

export function linkedSignal(parent: AbortSignal | undefined): {
  readonly controller: AbortController;
  cleanup(): void;
} {
  const controller = new AbortController();
  const abort = (): void => controller.abort();
  parent?.addEventListener('abort', abort, { once: true });
  if (parent?.aborted === true) controller.abort();
  return {
    controller,
    cleanup: () => parent?.removeEventListener('abort', abort),
  };
}
