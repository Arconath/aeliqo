import type { Diagnostic } from '@aeliqo/core';
import type { ScopeTransitionResult } from './types.js';

export function transitionFailure(
  status: Exclude<ScopeTransitionResult['status'], 'active' | 'needs-input'>,
  diagnosticCode: string,
): ScopeTransitionResult {
  return Object.freeze({ status, diagnosticCode });
}

export function needsInput(diagnosticCode: string): ScopeTransitionResult {
  return Object.freeze({
    status: 'needs-input',
    diagnosticCode,
    choices: Object.freeze(['save', 'discard', 'stay'] as const),
  });
}

export function firstDiagnosticCode(diagnostics: readonly Diagnostic[], fallback: string): string {
  return diagnostics[0]?.code ?? fallback;
}
