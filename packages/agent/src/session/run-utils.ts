import type { Outcome } from '@aeliqo/core';

export const failure = <T>(code: string, message: string): Outcome<T> => ({
  ok: false,
  diagnostics: [{ code, message, retryable: false }],
});
