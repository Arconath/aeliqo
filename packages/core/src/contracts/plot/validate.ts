import {parsePlotSpec} from './index.js';
import {parseResult} from '../parse.js';
import {WIRE_LIMITS} from '../limits.js';
import type {PlotSpec, PlotNode, PlotUnit, PlotEncoding} from './index.js';
import type {Outcome, Result, ResultRef, SemanticType} from '../types.js';

export interface BoundPlotUnit {
  readonly node: PlotUnit;
  readonly result: Result;
}
export interface BoundPlot {
  readonly spec: PlotSpec;
  readonly units: readonly BoundPlotUnit[];
}
const key = (r: ResultRef): string => JSON.stringify([r.id, r.revision, r.outputId, r.queryDigest, r.scopeDigest]);
const fail = (code: string, message: string): Outcome<never> => ({ok:false, diagnostics:[{code:`plot.${code}`,message,retryable:false}]});
const numeric = (t: SemanticType): boolean => ['integer','float','decimal'].includes(t.value);
function signature(e: PlotEncoding, t: SemanticType): string {
  return JSON.stringify([e.scale, e.zero ?? false, t.value,
    t.unit?.dimension, t.unit?.symbol, t.unit?.currency,
    t.temporal?.calendar, t.temporal?.timezone, t.temporal?.grain, t.grain]);
}
/** The caller supplies currently authorized descriptors; binding never reads or authorizes data. */
export function bindPlotSpec(input: unknown, authorizedResults: readonly Result[]): Outcome<BoundPlot> {
  const parsed = parsePlotSpec(input);
  if (!parsed.ok) return parsed;
  if (!Array.isArray(authorizedResults) || authorizedResults.length > WIRE_LIMITS.outputs)
    return fail('results', 'The authorized descriptor set exceeds its bound.');
  const results = new Map<string, Result>();
  for (const inputResult of authorizedResults) {
    const parsedResult = parseResult(inputResult);
    if (!parsedResult.ok) return parsedResult;
    const result = parsedResult.value;
    if (results.has(key(result.ref))) return fail('results', 'Result references must be unique.');
    if (new Set(result.fields.map(f => f.id)).size !== result.fields.length)
      return fail('fields', 'Result fields must have unique identities.');
    results.set(key(result.ref), result);
  }
  const units: BoundPlotUnit[] = [];
  let count = 0;
  const visit = (node: PlotNode): Outcome<readonly BoundPlotUnit[]> => {
    if (++count > 128) return fail('budget', 'The plot exceeds 128 composition nodes.');
    if (node.kind === 'unit') {
      const result = results.get(key(node.result));
      if (result === undefined) return fail('result', 'The exact result revision and scope are unavailable.');
      const enc = node.encoding;
      for (const [channel, encoding] of Object.entries(enc)) {
        const field = result.fields.find(f => f.id === encoding.field);
        if (field === undefined) return fail('field', 'An encoded field is absent from the result.');
        const type = field.type;
        if ((encoding.scale === 'linear' || encoding.scale === 'log') && !numeric(type))
          return fail('scale', 'A quantitative scale requires a numeric field.');
        if (encoding.scale === 'temporal' && type.value !== 'date' && type.value !== 'instant')
          return fail('scale', 'A temporal scale requires a date or instant field.');
        if (encoding.zero && encoding.scale !== 'linear') return fail('zero', 'Zero is supported only on linear scales.');
        if (channel === 'size' && encoding.scale !== 'linear') return fail('size', 'Size requires a linear scale.');
        if (channel === 'series' && encoding.scale !== 'ordinal') return fail('series', 'Series grouping requires an ordinal scale.');
      }
      if ((node.mark === 'line' || node.mark === 'area') && !['linear','log'].includes(enc.y.scale))
        return fail('mark', 'Line and area marks require quantitative y values.');
      if (node.mark === 'bar' || node.mark === 'area') {
        if (enc.y.scale !== 'linear' || enc.y.zero !== true)
          return fail('baseline', 'Bar and area marks require a linear y scale with a zero baseline.');
      }
      if ((node.mark === 'rect' || node.mark === 'link') && (enc.x2 === undefined || enc.y2 === undefined))
        return fail('endpoint', 'Rect and link marks require explicit second endpoints.');
      for (const [first, second] of [[enc.x,enc.x2],[enc.y,enc.y2]] as const) {
        if (second !== undefined && signature(first,result.fields.find(f=>f.id===first.field)!.type) !== signature(second,result.fields.find(f=>f.id===second.field)!.type))
          return fail('endpoint', 'Endpoint scales and semantic types must be compatible.');
      }
      const unit = {node, result}; units.push(unit);
      return {ok:true,value:[unit]};
    }
    const descendants: BoundPlotUnit[] = [];
    for (const child of node.kind === 'facet' ? [node.child] : node.children) {
      const next = visit(child); if (!next.ok) return next; descendants.push(...next.value);
    }
    if (node.kind === 'facet' && descendants.some(u => !u.result.fields.some(f=>f.id===node.field)))
      return fail('facet', 'The facet field must exist in every child result.');
    if (node.kind === 'facet') {
      const types = descendants.map(u => {
        const field = u.result.fields.find(f => f.id === node.field)!;
        return JSON.stringify([field.type.value, field.type.nullable, signature({field:node.field,scale:'ordinal'}, field.type)]);
      });
      if (new Set(types).size > 1) return fail('facet-type', 'Facet fields require the same semantic type, unit and temporal policy across child results.');
    }
    if (node.kind !== 'concat' && node.scales === 'shared-compatible') {
      const signatures = new Map<string,string>();
      for (const unit of descendants) for (const [channel,encoding] of Object.entries(unit.node.encoding)) {
        const s = signature(encoding,unit.result.fields.find(f=>f.id===encoding.field)!.type);
        if (signatures.has(channel) && signatures.get(channel) !== s)
          return fail('shared-scale', 'Shared scales require compatible field types, units and temporal policies.');
        signatures.set(channel,s);
      }
    }
    return {ok:true,value:descendants};
  };
  const checked = visit(parsed.value.root);
  return checked.ok ? {ok:true,value:{spec:parsed.value,units}} : checked;
}
