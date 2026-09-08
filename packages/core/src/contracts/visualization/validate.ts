import * as z from 'zod/mini';
import {histogramBinsSchema, idSchema, resultRefSchema, versionRefSchema} from '../schemas.js';
import {inspectWire as parseWireValue} from '../ingress.js';
import {parseCatalog, parseResult} from '../parse.js';
import {bindPlotSpec} from '../plot/index.js';
import type {BoundPlot} from '../plot/index.js';
import {WIRE_LIMITS} from '../limits.js';
import {parseVisualizationSpec} from './index.js';
import type {VisualizationSpec} from './index.js';
import type {Catalog, FieldDefinition, MeaningDefinition, Outcome, Result, ResultRef, SemanticType, VersionRef} from '../types.js';

/** Trusted host declaration connecting an edge materialization to catalog entities. */
export interface VisualizationRelationshipBinding {
  readonly result: ResultRef;
  readonly relationship: VersionRef;
  readonly source: readonly string[];
  readonly target: readonly string[];
}
export interface VisualizationHistogramBinding {
  readonly result: ResultRef;
  readonly bins: Extract<VisualizationSpec, {readonly view: 'histogram'}>['bins'];
}
const projections = z.array(idSchema).check(z.minLength(1), z.maxLength(16));
const relationshipBindingsSchema = z.array(z.strictObject({result: resultRefSchema, relationship: versionRefSchema, source: projections, target: projections})).check(z.maxLength(128));
const histogramBindingsSchema = z.array(z.strictObject({result: resultRefSchema, bins: histogramBinsSchema})).check(z.maxLength(128));
export interface VisualizationBindingContext {
  readonly results: readonly Result[];
  /** Authorized application Catalog; schema shape alone never grants access. */
  readonly catalog?: Catalog;
  readonly relationships?: readonly VisualizationRelationshipBinding[];
  readonly histograms?: readonly VisualizationHistogramBinding[];
}
export interface BoundVisualization {
  readonly spec: VisualizationSpec;
  readonly results: readonly Result[];
  readonly plot?: BoundPlot;
  readonly meaning?: MeaningDefinition;
  readonly relationship?: Catalog['relationships'][number];
}
const fail = (code: string, message: string): Outcome<never> => ({ok: false, diagnostics: [{code: `visualization.${code}`, message, retryable: false}]});
const key = (ref: ResultRef): string => JSON.stringify([ref.id, ref.revision, ref.outputId, ref.queryDigest, ref.scopeDigest]);
const refKey = (ref: VersionRef): string => JSON.stringify([ref.id, ref.revision]);
const numeric = (type: SemanticType): boolean => ['integer', 'float', 'decimal'].includes(type.value);
const temporal = (type: SemanticType): boolean => (type.value === 'date' || type.value === 'instant') && type.temporal !== undefined
  && (type.value !== 'instant' || type.temporal.timezone !== undefined);
const signature = (type: SemanticType, nullable = true): string => JSON.stringify([type.value, nullable ? type.nullable : undefined, type.unit?.dimension, type.unit?.symbol, type.unit?.currency,
  type.temporal?.calendar, type.temporal?.timezone, type.temporal?.grain]);
function own<T>(value: T): T {
  if (value !== null && typeof value === 'object') {for (const child of Object.values(value)) own(child); Object.freeze(value);}
  return value;
}
const sameSet = (a: readonly string[], b: readonly string[]): boolean => a.length === b.length && a.every(id => b.includes(id));

/** Bind family meaning to authorized descriptors. This neither reads rows nor grants effects.
 * Row-level ordering, bins, hierarchy cycles and edge cardinality are checked by
 * the bounded geometry materializer before any marks or interactions are exposed.
 */
export function bindVisualizationSpec(input: unknown, context: VisualizationBindingContext): Outcome<BoundVisualization> {
  const parsed = parseVisualizationSpec(input); if (!parsed.ok) return parsed;
  const spec = parsed.value;
  if (!Array.isArray(context.results) || context.results.length > WIRE_LIMITS.outputs) return fail('results', 'Authorized results must be bounded.');
  const results = new Map<string, Result>();
  for (const inputResult of context.results) {
    const parsedResult = parseResult(inputResult); if (!parsedResult.ok) return parsedResult;
    const result = parsedResult.value;
    if (results.has(key(result.ref))) return fail('results', 'An exact result reference is repeated.');
    const fieldIds = result.fields.map(field => field.id);
    if (new Set(fieldIds).size !== fieldIds.length || result.identity.length === 0 || new Set(result.identity).size !== result.identity.length
      || new Set(result.rowGrain).size !== result.rowGrain.length || result.rowGrain.length === 0
      || [...result.identity, ...result.rowGrain].some(id => !fieldIds.includes(id))
      || result.identity.some(id => result.fields.find(field => field.id === id)!.type.nullable))
      return fail('identity', 'Visualization rows require declared nonnullable stable identity and field-based grain.');
    if (result.counts.population.kind === 'exact' && (result.counts.loaded > result.counts.population.value
      || (result.coverage.kind === 'complete' && result.counts.loaded !== result.counts.population.value)))
      return fail('scope', 'Loaded counts cannot overstate exact population completeness.');
    if (result.counts.population.kind !== 'unknown' && result.coverage.kind !== 'unknown' && result.counts.population.populationDigest !== result.coverage.populationDigest)
      return fail('scope', 'Population count and coverage must describe the same population.');
    results.set(key(result.ref), result);
  }
  let catalog: Catalog | undefined;
  if (context.catalog !== undefined) {
    const checked = parseCatalog(context.catalog); if (!checked.ok) return checked; catalog = checked.value;
    if (new Set(catalog.entities.map(entity => entity.id)).size !== catalog.entities.length
      || new Set(catalog.relationships.map(refKey)).size !== catalog.relationships.length
      || new Set(catalog.meanings.map(refKey)).size !== catalog.meanings.length) return fail('catalog', 'Catalog identities must be unambiguous.');
  }
  let meaning: MeaningDefinition | undefined;
  const additive = (ref: VersionRef, field: FieldDefinition): Outcome<true> => {
    const found = catalog?.meanings.find(item => refKey(item) === refKey(ref));
    if (!numeric(field.type) || found === undefined || found.lifecycle !== 'active' || found.authority === 'hypothesis' || found.functionRegistryDigest !== catalog?.functionRegistryDigest || found.aggregation !== 'additive'
      || field.derivation === undefined || refKey(field.derivation) !== refKey(found) || signature(found.output) !== signature(field.type)
      || (found.output.grain !== undefined && !sameSet(found.output.grain, field.type.grain ?? [])))
      return fail('additivity', 'Area magnitude requires an active authorized additive meaning pinned by the result field.');
    meaning = found; return {ok: true, value: true};
  };
  if ('plot' in spec) {
    const bound = bindPlotSpec(spec.plot, [...results.values()]); if (!bound.ok) return bound;
    for (const unit of bound.value.units) {
      const fields = new Map(unit.result.fields.map(field => [field.id, field]));
      const encoding = unit.node.encoding;
      const x = fields.get(encoding.x.field)!; const y = fields.get(encoding.y.field)!;
      const mark = unit.node.mark;
      if (spec.view === 'trend' || spec.view === 'area') {
        if (mark !== (spec.view === 'trend' ? 'line' : 'area') || encoding.x.scale !== 'temporal' || !temporal(x.type) || x.type.temporal?.grain === undefined || !numeric(y.type)
          || !unit.result.rowGrain.includes(x.id)) return fail('trend', 'Temporal views require temporal grain and quantitative observations.');
        if (spec.view === 'area') {
          const checked = additive(spec.meaning, y); if (!checked.ok) return checked;
          if (spec.stack === 'zero' && encoding.series === undefined) return fail('stack', 'Stacked area requires an explicit series dimension.');
        }
      } else if (spec.view === 'bar') {
        if (mark !== 'bar' || encoding.x.scale !== 'ordinal' || !numeric(y.type)) return fail('bar', 'Bar views require categories and a quantitative zero baseline.');
      } else if (spec.view === 'scatter') {
        if (mark !== 'point' || !numeric(x.type) || !numeric(y.type) || !['linear', 'log'].includes(encoding.x.scale) || !['linear', 'log'].includes(encoding.y.scale))
          return fail('scatter', 'Scatter requires two quantitative axes.');
      } else if (spec.view === 'histogram') {
        const inspected = parseWireValue(context.histograms ?? []); if (!inspected.ok) return inspected;
        const declarations = z.safeParse(histogramBindingsSchema, inspected.value);
        if (!declarations.success || declarations.data.filter(binding => key(binding.result) === key(unit.result.ref)
          && binding.bins.start === spec.bins.start && binding.bins.end === spec.bins.end && binding.bins.value === spec.bins.value
          && binding.bins.measure === spec.bins.measure && binding.bins.boundary === spec.bins.boundary).length !== 1)
          return fail('histogram', 'The exact bin projection and count/density meaning must be declared once by the authorized host.');
        const end = fields.get(spec.bins.end);
        if (mark !== 'rect' || encoding.x.field !== spec.bins.start || encoding.x2?.field !== spec.bins.end || encoding.y.field !== spec.bins.value
          || encoding.y2 === undefined || !numeric(x.type) || !numeric(y.type) || end === undefined || signature(x.type) !== signature(end.type)
          || encoding.x.scale !== 'linear' || encoding.y.scale !== 'linear' || encoding.y.zero !== true
          || !unit.result.rowGrain.includes(spec.bins.start) || !unit.result.rowGrain.includes(spec.bins.end)
          || (spec.bins.measure === 'count' && y.type.value !== 'integer'))
          return fail('histogram', 'Histogram requires executor-provided explicit numeric bin endpoints and a count or density measure.');
      } else if (spec.view === 'heatmap') {
        const color = encoding.color === undefined ? undefined : fields.get(encoding.color.field);
        if (mark !== 'cell' || encoding.x.scale !== 'ordinal' || encoding.y.scale !== 'ordinal' || color === undefined || !numeric(color.type)
          || x.id === y.id || color.id === x.id || color.id === y.id || encoding.color?.scale !== 'linear' || !unit.result.rowGrain.includes(x.id) || !unit.result.rowGrain.includes(y.id))
          return fail('heatmap', 'Heatmap requires two declared grain dimensions and a quantitative color measure.');
      }
    }
    const used = [...new Map(bound.value.units.map(unit => [key(unit.result.ref), unit.result])).values()];
    return {ok: true, value: own({spec, results: used, plot: bound.value, ...(meaning === undefined ? {} : {meaning})})};
  }
  const result = results.get(key(spec.result)); if (result === undefined) return fail('result', 'The exact result revision and scope are unavailable.');
  const fields = new Map(result.fields.map(field => [field.id, field]));
  const required: string[] = [];
  if (spec.view === 'matrix') required.push(...spec.columns);
  else if (spec.view === 'tree' || spec.view === 'treemap') required.push(...spec.node, ...spec.parent, ...(spec.label ? [spec.label] : []), ...(spec.view === 'treemap' ? [spec.value] : []));
  else if (spec.view === 'relationship') required.push(...spec.source, ...spec.target, ...(spec.label ? [spec.label] : []));
  else if (spec.view === 'timeline') required.push(spec.start, ...(spec.end ? [spec.end] : []), ...(spec.label ? [spec.label] : []));
  else required.push(spec.date, ...(spec.value ? [spec.value] : []), ...(spec.label ? [spec.label] : []));
  if (required.some(id => !fields.has(id))) return fail('field', 'A visualization field is absent from its authorized result.');
  let relationship: Catalog['relationships'][number] | undefined;
  if (spec.view === 'matrix') {
    if (new Set(spec.columns).size !== spec.columns.length) return fail('matrix', 'Matrix columns must be unique.');
  } else if (spec.view === 'tree' || spec.view === 'treemap') {
    if (new Set(spec.node).size !== spec.node.length || !sameSet(spec.node, result.identity) || !sameSet(spec.node, result.rowGrain) || spec.node.length !== spec.parent.length
      || new Set(spec.parent).size !== spec.parent.length || spec.node.some(id => spec.parent.includes(id))
      || spec.node.some((id, index) => signature(fields.get(id)!.type, false) !== signature(fields.get(spec.parent[index]!)!.type, false)))
      return fail('hierarchy', 'Hierarchy requires one row per stable node and compatible explicit parent keys.');
    if (spec.view === 'treemap') {const checked = additive(spec.meaning, fields.get(spec.value)!); if (!checked.ok) return checked;}
  } else if (spec.view === 'relationship') {
    relationship = catalog?.relationships.find(item => refKey(item) === refKey(spec.relationship));
    const source = catalog?.entities.find(entity => entity.id === relationship?.sourceEntity);
    const target = catalog?.entities.find(entity => entity.id === relationship?.targetEntity);
    if (relationship === undefined || source === undefined || target === undefined || spec.source.length !== source.identity.length || spec.target.length !== target.identity.length
      || new Set(spec.source).size !== spec.source.length || new Set(spec.target).size !== spec.target.length)
      return fail('relationship', 'Relationship view requires a declared versioned relation and stable endpoint identities.');
    const mappings = parseWireValue(context.relationships ?? []); if (!mappings.ok) return mappings;
    const declarations = z.safeParse(relationshipBindingsSchema, mappings.value);
    if (!declarations.success) return fail('relationship', 'Authorized edge bindings must be bounded and well formed.');
    const authorizedMapping = declarations.data.filter(item => JSON.stringify(item.source) === JSON.stringify(spec.source)
      && JSON.stringify(item.target) === JSON.stringify(spec.target) && key(item.result) === key(spec.result)
      && refKey(item.relationship) === refKey(spec.relationship));
    if (authorizedMapping.length !== 1) return fail('relationship', 'The exact endpoint projection must be declared once by the authorized host.');
    for (const [entity, projection] of [[source, spec.source], [target, spec.target]] as const) {
      for (const [index, id] of entity.identity.entries()) {
        const field = entity.fields.find(field => field.id === id);
        if (field === undefined || field.type.nullable || signature(field.type) !== signature(fields.get(projection[index]!)!.type))
          return fail('relationship', 'Edge endpoint fields do not match the declared entity identities.');
      }
    }
  } else {
    const first = fields.get(spec.view === 'timeline' ? spec.start : spec.date)!;
    if (!temporal(first.type)) return fail('temporal', 'Dated views require a declared calendar and timezone for instants.');
    if (spec.view === 'timeline' && spec.end !== undefined && signature(first.type) !== signature(fields.get(spec.end)!.type))
      return fail('temporal', 'Interval endpoints must share their temporal policy.');
    if (spec.view === 'calendar-grid' && spec.value !== undefined && !numeric(fields.get(spec.value)!.type))
      return fail('calendar', 'A calendar value field must be quantitative; labels may remain textual.');
  }
  return {ok: true, value: own({spec, results: [result], ...(meaning === undefined ? {} : {meaning}), ...(relationship === undefined ? {} : {relationship})})};
}
