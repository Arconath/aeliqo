import type {Diagnostic, Outcome} from '../contracts/types.js';
export function wireFailure(code: string, message: string, path: readonly (string | number)[] = []): Outcome<never> {
  return {ok: false, diagnostics: [{code, message, path, retryable: false}]};
}
export function wireDiagnostic(code: string, path: readonly (string | number)[]): Diagnostic {
  return {code, message: 'The value does not match the declared wire contract.', path, retryable: false};
}
