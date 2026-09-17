import { WIRE_LIMITS } from '@aeliqo/core';
import type { Diagnostic, QuerySpec, ResultRef } from '@aeliqo/core';
import type { LogicalPlan, QueryResult } from '@aeliqo/core/query';
import type { AcceptedQuery, PlanAcceptance } from '../types.js';
import type { ResultEvent as DataResultEvent } from '../types.js';
import { canonical, diagnostic } from './shared.js';
import { encodeCursor } from './cursor.js';

export type ResultEvidence =
  | { readonly kind: 'observed'; readonly source: { readonly id: string; readonly revision: string } }
  | {
      readonly kind: 'computed';
      readonly queryDigest: string;
      readonly definitions: readonly { readonly id: string; readonly revision: string }[];
    };

export function resultError(requestId: string, code: string, message: string): DataResultEvent {
  return { kind: 'error', requestId, error: diagnostic(code, message) };
}

export function resultReference(accepted: AcceptedQuery, resultId: string): ResultRef {
  return {
    id: resultId,
    revision: accepted.sourceRevision,
    outputId: accepted.target.outputId,
    queryDigest: accepted.queryDigest,
    scopeDigest: accepted.scopeDigest,
  };
}

export function eventBytes(event: DataResultEvent): number {
  return new TextEncoder().encode(`${JSON.stringify(event)}\n`).byteLength;
}

export function pageCursor(accepted: AcceptedQuery, offset: number): string {
  return encodeCursor({
    kind: 'data',
    queryDigest: accepted.queryDigest,
    scopeDigest: accepted.scopeDigest,
    sourceRevision: accepted.sourceRevision,
    catalogRevision: accepted.catalogRevision,
    target: accepted.target.outputId,
    ...(accepted.policyRevision === undefined ? {} : { policyRevision: accepted.policyRevision }),
    offset,
  });
}

export function sameAccepted(left: AcceptedQuery | PlanAcceptance, right: AcceptedQuery): boolean {
  return canonical(acceptedParts(left)) === canonical(right);
}

function acceptedParts(value: AcceptedQuery | PlanAcceptance): AcceptedQuery {
  const { kind: _kind, supported: _supported, ...accepted } = value as PlanAcceptance;
  return accepted as AcceptedQuery;
}

export function resultWarnings(result: QueryResult): readonly Diagnostic[] {
  const unique = new Map<string, Diagnostic>();
  for (const unknown of result.unknown) {
    const key = JSON.stringify([unknown.field, unknown.reason]);
    if (unique.has(key)) continue;
    unique.set(
      key,
      diagnostic('data.unknown', `Output ${unknown.field} has unknown values: ${unknown.reason}.`, [
        'result',
        unknown.field,
      ]),
    );
  }
  const warnings = [...unique.values()];
  if (warnings.length <= WIRE_LIMITS.diagnostics) return Object.freeze(warnings);
  return Object.freeze([
    ...warnings.slice(0, WIRE_LIMITS.diagnostics - 1),
    diagnostic(
      'data.unknown',
      `${warnings.length - WIRE_LIMITS.diagnostics + 1} additional field/reason combinations contain unknown values. Inspect the result values before making claims.`,
      ['result'],
    ),
  ]);
}

export function resultPrecision(result: QueryResult):
  | { readonly kind: 'exact' }
  | {
      readonly kind: 'approximate';
      readonly method: string;
      readonly uncertainty: { readonly kind: 'unquantified'; readonly reason: string };
    } {
  if (result.precision.kind === 'exact') return { kind: 'exact' };
  return {
    kind: 'approximate',
    method: result.precision.method,
    uncertainty: { kind: 'unquantified', reason: 'The bounded evaluator does not quantify numerical uncertainty.' },
  };
}

export function resultEvidence(
  result: QueryResult,
  plan: LogicalPlan,
  query: QuerySpec,
  queryDigest: string,
): ResultEvidence {
  if (!containsDerivedOperation(plan))
    return { kind: 'observed', source: { id: 'local-source', revision: result.sourceRevision } };
  return { kind: 'computed', queryDigest, definitions: query.measures };
}

function containsDerivedOperation(plan: LogicalPlan): boolean {
  return plan.nodes.some((node) => {
    switch (node.op) {
      case 'derive':
      case 'time-bucket':
      case 'window':
      case 'join':
      case 'semijoin':
      case 'group':
      case 'aggregate':
        return true;
      default:
        return false;
    }
  });
}

export function resultPopulation(result: QueryResult, populationDigest: string) {
  if (!result.complete) return { kind: 'unknown' as const };
  return { kind: 'exact' as const, value: result.rows.length, populationDigest };
}
