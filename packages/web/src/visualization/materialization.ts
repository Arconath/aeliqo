import {parseWireValue, scalarIdentity, validateScalar} from '@aeliqo/core';
import type {BoundVisualization, Outcome, Result, Scalar} from '@aeliqo/core';
import type {VisualizationDataset, VisualizationRow} from './types.js';
const key = (result: Result['ref']): string => JSON.stringify([result.id, result.revision, result.outputId, result.queryDigest, result.scopeDigest]);
const fail = (code: string, message: string): Outcome<never> => ({ok: false, diagnostics: [{code: `visualization.${code}`, message, retryable: false}]});
/** The pure core binder must have accepted this descriptor first. No row index
 * or shape-valid reference is an authorization grant; host owns current rows. */
export function materializeVisualizationRows(bound: BoundVisualization, resultRef: Result['ref'], datasets: readonly VisualizationDataset[]): Outcome<readonly VisualizationRow[]> {
  const inspectedRef = parseWireValue(resultRef); if (!inspectedRef.ok) return inspectedRef;
  const ref = inspectedRef.value;
  if (ref === null || typeof ref !== 'object' || Array.isArray(ref) || Object.keys(ref).length !== 5
    || ['id', 'revision', 'outputId', 'queryDigest', 'scopeDigest'].some(name => !Object.hasOwn(ref, name) || typeof (ref as Record<string, unknown>)[name] !== 'string' || !(ref as Record<string, unknown>)[name]))
    return fail('binding', 'The selected result reference is malformed.');
  const result = bound.results.find(item => key(item.ref) === key(ref as unknown as Result['ref']));
  if (result === undefined) return fail('binding', 'The result does not belong to this bound visualization.');
  const inspected = parseWireValue(datasets); if (!inspected.ok) return inspected;
  if (!Array.isArray(inspected.value) || inspected.value.length > 64) return fail('datasets', 'Materializations must be bounded.');
  const seenRefs = new Set<string>(); let rows: unknown;
  for (const item of inspected.value) {
    if (item === null || typeof item !== 'object' || Array.isArray(item) || Object.keys(item).some(name => name !== 'result' && name !== 'rows')
      || item.result === null || typeof item.result !== 'object' || Array.isArray(item.result)) return fail('dataset', 'A materialization requires an exact result reference and rows.');
    const ref = item.result as unknown as Result['ref'];
    if (Object.keys(ref).length !== 5 || [ref.id, ref.revision, ref.outputId, ref.queryDigest, ref.scopeDigest].some(value => typeof value !== 'string' || !value))
      return fail('dataset', 'A materialization reference is malformed.');
    const refId = key(ref); if (seenRefs.has(refId)) return fail('datasets', 'An exact materialization reference is repeated.'); seenRefs.add(refId);
    if (refId === key(result.ref)) rows = item.rows;
  }
  if (!Array.isArray(rows) || rows.length !== result.counts.loaded || rows.length > 10_000 || rows.length * result.fields.length > 100_000)
    return fail('rows', 'The authorized loaded rows must match the descriptor and remain within the row/cell budget.');
  const fields = new Map(result.fields.map(field => [field.id, field])); const identities = new Set<string>(); const output: VisualizationRow[] = [];
  for (const row of rows) {
    if (row === null || typeof row !== 'object' || Array.isArray(row) || Object.keys(row).some(field => !fields.has(field))) return fail('row', 'A row contains undeclared fields.');
    const values: Record<string, Scalar> = Object.create(null) as Record<string, Scalar>;
    for (const field of result.fields) {
      const raw = Object.hasOwn(row, field.id) ? (row as Record<string, unknown>)[field.id] : undefined;
      const checked = validateScalar(raw === undefined && field.type.nullable ? null : raw, field.type); if (!checked.ok) return checked;
      values[field.id] = checked.value;
    }
    const parts: string[] = [];
    for (const id of result.identity) {
      const field = fields.get(id);
      if (field === undefined || values[id] === null) return fail('identity', 'A stable identity value is unavailable.');
      const checked = scalarIdentity(values[id], field.type); if (!checked.ok) return checked; parts.push(checked.value);
    }
    const identity = JSON.stringify(parts); if (identities.has(identity)) return fail('identity', 'Row identities must be unique.'); identities.add(identity);
    output.push(Object.freeze({identity, values: Object.freeze(values)}));
  }
  return {ok: true, value: Object.freeze(output)};
}
