import {createAeliqoVisualizationPresentationManifests,type AeliqoAuthorizedVisualizationBindings} from "./visualization-registry.js";
import {createAeliqoDataPresentationManifests, type AeliqoAuthorizedDataBindings} from "./data-presentation.js";
import {createNavigationFeedbackPresentationManifests, type AeliqoNavigationFeedbackBindings} from "./navigation-feedback-registry.js";
import {createInputPresentationManifests, type AeliqoInputBindings} from "./input-registry.js";
import {createFoundationPresentationManifests, type AeliqoFoundationBindings} from "./foundation-registry.js";
import {
  createPresentationRegistry,
  type InteractionMappingManifest,
  type InteractionPort,
  type Outcome,
  type PresentationManifest,
  type PresentationRegistry,
  type PresentationValues,
  type Result,
  type ResolvedPresentationConfig,
  type Task,
  type VersionRef,
} from "@aeliqo/sdk-core";

const MAX_ITEMS = 128;
const MAX_LABEL = 160;

/** Trusted application-owned context used to bind wire proposals to data semantics. */
export interface AeliqoPresentationRegistryOptions {
  /** Reviewed static content/action/route bindings; changes require a new Experience revision. */
  readonly foundation?: AeliqoFoundationBindings;
  readonly inputs?: AeliqoInputBindings;
  readonly navigationFeedback?: AeliqoNavigationFeedbackBindings;
  /** Exact authorized materializations used to validate data-view field scope. */
  readonly data?: AeliqoAuthorizedDataBindings;
  readonly visualizations?: AeliqoAuthorizedVisualizationBindings;
  /** Resolve the entity represented by an authorized result. Never take this from presentation config. */
  readonly resolveEntity?: (result: Result) => string | undefined;
}

export const AELIQO_PRESENTATION_REFS = Object.freeze({
  stack: {id: "layout.stack", revision: "1"},
  table: {id: "data.table", revision: "1"},
  trend: {id: "data.trend", revision: "1"},
  filter: {id: "control.filter", revision: "1"},
} satisfies Record<string, VersionRef>);

export const AELIQO_CONFIG_SCHEMAS = Object.freeze({
  stack: {id: "layout.stack.config", revision: "1"},
  table: {id: "data.table.config", revision: "1"},
  trend: {id: "data.trend.config", revision: "1"},
  filter: {id: "control.filter.config", revision: "1"},
} satisfies Record<string, VersionRef>);

export const AELIQO_OPERATION_REFS = Object.freeze({
  read: {id: "data.read", revision: "1"},
  selection: {id: "interaction.selection", revision: "1"},
  filter: {id: "data.filter", revision: "1"},
  range: {id: "data.range", revision: "1"},
  compare: {id: "data.compare", revision: "1"},
} satisfies Record<string, VersionRef>);

const fail = <T>(code: string, message: string): Outcome<T> => ({ok: false,
  diagnostics: [{code: `web.presentation.${code}`, message, retryable: false}]});

function record(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
}

function text(value: unknown, field: string): Outcome<string> {
  if (typeof value !== "string" || value.length === 0 || value.length > MAX_LABEL || /[\u0000-\u001f\u007f]/u.test(value))
    return fail("config", `${field} must be a bounded text value.`);
  return {ok: true, value};
}

function optionalText(values: Record<string, unknown>, key: string): Outcome<string | undefined> {
  if (!Object.hasOwn(values, key)) return {ok: true, value: undefined};
  return text(values[key], key);
}

function fieldMap(result: Result): Map<string, Result["fields"][number]> { return new Map(result.fields.map((field) => [field.id, field])); }

function columns(values: Record<string, unknown>, result: Result): Outcome<readonly {readonly key: string; readonly label: string}[]> {
  const fields = fieldMap(result);
  const raw = values.columns;
  if (raw === undefined) return {ok: true, value: result.fields.map((field) => ({key: field.id, label: field.label}))};
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > MAX_ITEMS) return fail("config", "columns must be a bounded nonempty array.");
  const output: {key: string; label: string}[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    const candidate = record(item);
    if (candidate === undefined || Object.keys(candidate).some((key) => key !== "key" && key !== "label") || !Object.hasOwn(candidate, "key"))
      return fail("config", "Every column requires a field key and may not redefine its descriptor label.");
    const key = text(candidate.key, "column.key");
    if (!key.ok) return key;
    const descriptor = fields.get(key.value);
    if (descriptor === undefined || seen.has(key.value)) return fail("field", `Column ${key.value} is not a unique field in the bound result.`);
    if (candidate.label !== undefined) {
      const label = text(candidate.label, "column.label");
      if (!label.ok) return label;
      if (label.value !== descriptor.label) return fail("field", `Column ${key.value} must use its registered descriptor label.`);
    }
    seen.add(key.value); output.push({key: key.value, label: descriptor.label});
  }
  return {ok: true, value: output};
}

function identity(values: Record<string, unknown>, result: Result): Outcome<readonly string[]> {
  const raw = values.identity;
  const candidate = raw === undefined ? result.identity : raw;
  if (!Array.isArray(candidate) || candidate.length === 0 || candidate.length > MAX_ITEMS || candidate.some((item) => typeof item !== "string" || item.length === 0))
    return fail("identity", "identity must name one or more bounded result fields.");
  const fields = fieldMap(result);
  if (new Set(candidate).size !== candidate.length || candidate.some((field) => !fields.has(field))) return fail("identity", "identity fields must be unique fields in the bound result.");
  if (raw !== undefined && JSON.stringify(candidate) !== JSON.stringify(result.identity)) return fail("identity", "identity must match the Result descriptor identity.");
  return {ok: true, value: [...candidate]};
}

function temporalField(field: Result["fields"][number]): boolean {
  return field.type.value === "date" || field.type.value === "instant";
}

function numericField(field: Result["fields"][number]): boolean {
  return field.type.value === "integer" || field.type.value === "float" || field.type.value === "decimal";
}

function unitKey(field: Result["fields"][number]): string {
  const unit = field.type.unit;
  return unit === undefined ? "" : JSON.stringify([unit.dimension, unit.symbol, unit.currency ?? null]);
}

function trendGrain(seriesBy: readonly string[], labelField: string, result: Result): Outcome<undefined> {
  const expected = new Set([...seriesBy, labelField]);
  const actual = new Set(result.rowGrain);
  if (expected.size !== actual.size || [...actual].some((field) => !expected.has(field))) return fail("grain", "Trend grouping and temporal fields must identify each row grain without hidden dimensions.");
  return {ok: true, value: undefined};
}

function trustedEntity(result: Result, resolveEntity: AeliqoPresentationRegistryOptions["resolveEntity"]): Outcome<string | undefined> {
  if (resolveEntity === undefined) return {ok: true, value: undefined};
  let value: string | undefined;
  try { value = resolveEntity(result); } catch { return fail("binding", "The trusted result entity resolver failed."); }
  if (value === undefined) return {ok: true, value: undefined};
  return text(value, "resolved entity");
}

function selectionPort(values: Record<string, unknown>, result: Result | undefined, portId: string, resolveEntity: AeliqoPresentationRegistryOptions["resolveEntity"]): Outcome<readonly [InteractionPort] | readonly []> {
  if (values.selection === undefined || values.selection === "none") return {ok: true, value: []};
  if (values.selection !== "single" && values.selection !== "multiple") return fail("config", "selection must be none, single or multiple.");
  if (result === undefined) return fail("binding", "A selectable representation requires a bound result.");
  const owner = trustedEntity(result, resolveEntity); if (!owner.ok) return owner;
  if (owner.value === undefined) return fail("binding", "Selectable views require a trusted entity binding for their authorized result.");
  const fields = identity(values, result); if (!fields.ok) return fields;
  return {ok: true, value: [{id: portId, direction: "inout", payload: "selection", entity: owner.value, identity: fields.value, grain: result.rowGrain}]};
}

function stackConfig(values: PresentationValues): Outcome<ResolvedPresentationConfig> {
  const input = record(values); if (input === undefined) return fail("config", "The stack configuration must be an object.");
  if (Object.keys(input).some((key) => key !== "gap")) return fail("config", "The stack configuration only accepts gap.");
  if (input.gap !== undefined && (!Number.isSafeInteger(input.gap) || (input.gap as number) < 0 || (input.gap as number) > 64)) return fail("config", "gap must be a bounded nonnegative integer.");
  return {ok: true, value: {values: Object.keys(input).length === 0 ? {} : {gap: input.gap as number}, fields: [], ports: [], operations: []}};
}

function tableConfig(values: PresentationValues, result: Result | undefined, resolveEntity: AeliqoPresentationRegistryOptions["resolveEntity"]): Outcome<ResolvedPresentationConfig> {
  if (result === undefined) return fail("binding", "A table requires a bound result.");
  const input = record(values); if (input === undefined) return fail("config", "The table configuration must be an object.");
  if (Object.keys(input).some((key) => !["columns", "identity", "selection"].includes(key))) return fail("config", "The table configuration contains an unknown field.");
  const columnList = columns(input, result); if (!columnList.ok) return columnList;
  const selected = input.selection ?? "none";
  if (selected !== "none" && selected !== "single" && selected !== "multiple") return fail("config", "selection must be none, single or multiple.");
  const identityFields = input.identity === undefined ? {ok: true as const, value: undefined} : identity(input, result);
  if (!identityFields.ok) return identityFields;
  const port = selectionPort(input, result, "selection", resolveEntity); if (!port.ok) return port;
  const output: Record<string, unknown> = {columns: columnList.value, selection: selected, ...(identityFields.value === undefined ? {} : {identity: identityFields.value})};
  const operations = selected === "none" ? [AELIQO_OPERATION_REFS.read] : [AELIQO_OPERATION_REFS.read, AELIQO_OPERATION_REFS.selection];
  return {ok: true, value: {values: output as PresentationValues, fields: columnList.value.map((column) => column.key), ports: port.value, operations}};
}

function trendConfig(values: PresentationValues, result: Result | undefined): Outcome<ResolvedPresentationConfig> {
  if (result === undefined) return fail("binding", "A trend requires a bound result.");
  const input = record(values); if (input === undefined) return fail("config", "The trend configuration must be an object.");
  if (Object.keys(input).some((key) => !["labelField", "series", "seriesBy"].includes(key))) return fail("config", "The trend configuration contains an unknown field.");
  const labelField = text(input.labelField, "labelField"); if (!labelField.ok) return labelField;
  const fields = fieldMap(result); const temporal = fields.get(labelField.value);
  if (temporal === undefined || !temporalField(temporal)) return fail("field", "labelField must be a declared temporal date or instant field.");
  if (!Array.isArray(input.series) || input.series.length === 0 || input.series.length > 8) return fail("config", "series must contain one to eight entries.");
  const series: {readonly field: string; readonly label: string; readonly unit?: string}[] = [];
  const seen = new Set<string>();
  let firstUnitKey: string | undefined;
  for (const item of input.series) {
    const candidate = record(item); if (candidate === undefined || Object.keys(candidate).some((key) => !["field", "label", "unit"].includes(key))) return fail("config", "Trend series entries are malformed.");
    const field = text(candidate.field, "series.field"); if (!field.ok) return field;
    const descriptor = fields.get(field.value);
    if (descriptor === undefined || !numericField(descriptor) || seen.has(field.value)) return fail("field", "Trend series fields must be unique declared numeric fields in the bound result.");
    let labelValue = descriptor.label;
    if (candidate.label !== undefined) {
      const label = text(candidate.label, "series.label"); if (!label.ok) return label;
      if (label.value !== descriptor.label) return fail("field", `Trend series ${field.value} must use its registered descriptor label.`);
    }
    const unit = optionalText(candidate, "unit"); if (!unit.ok) return unit;
    const descriptorUnit = descriptor.type.unit?.symbol;
    if (unit.value !== undefined && unit.value !== descriptorUnit) return fail("field", `Trend series ${field.value} must use its registered descriptor unit.`);
    const descriptorUnitKey = unitKey(descriptor);
    if (firstUnitKey === undefined) firstUnitKey = descriptorUnitKey;
    else if (descriptorUnitKey !== firstUnitKey) return fail("field", "Trend series fields must use one compatible numeric unit on a shared y-axis.");
    seen.add(field.value); series.push({field: field.value, label: labelValue, ...(descriptorUnit === undefined ? {} : {unit: descriptorUnit})});
  }
  const grouping = input.seriesBy;
  if (grouping !== undefined && (!Array.isArray(grouping) || grouping.length > MAX_ITEMS || grouping.some((value) => typeof value !== "string" || value.length === 0))) return fail("config", "seriesBy must contain bounded result field IDs.");
  const seriesBy = grouping === undefined ? [] : [...grouping as string[]];
  if (new Set(seriesBy).size !== seriesBy.length || seriesBy.some((field) => !fields.has(field) || field === labelField.value || series.some((entry) => entry.field === field))) return fail("field", "seriesBy fields must be unique grouping fields distinct from temporal and measure fields.");
  const grain = trendGrain(seriesBy, labelField.value, result); if (!grain.ok) return grain;
  const output: Record<string, unknown> = {labelField: labelField.value, series, seriesBy};
  return {ok: true, value: {values: output as PresentationValues, fields: [labelField.value, ...seriesBy, ...series.map((entry) => entry.field)], ports: [], operations: [AELIQO_OPERATION_REFS.read, AELIQO_OPERATION_REFS.compare]}};
}

function filterConfig(values: PresentationValues, result: Result | undefined, resolveEntity: AeliqoPresentationRegistryOptions["resolveEntity"]): Outcome<ResolvedPresentationConfig> {
  const input = record(values); if (input === undefined) return fail("config", "The filter configuration must be an object.");
  if (Object.keys(input).some((key) => !["field", "outputId"].includes(key))) return fail("config", "The filter configuration contains an unknown field.");
  const field = text(input.field, "field"); if (!field.ok) return field;
  const outputId = text(input.outputId, "outputId"); if (!outputId.ok) return outputId;
  if (result === undefined) return fail("binding", "A filter requires a bound authorized result.");
  const descriptor = fieldMap(result).get(field.value);
  if (descriptor === undefined) return fail("field", "The filter field is absent from the bound result.");
  if (descriptor.type.value !== "text") return fail("field", "Filter controls accept only text result fields.");
  if (outputId.value !== result.ref.outputId) return fail("binding", "The filter output must match the bound authorized result.");
  const owner = result === undefined ? {ok: true as const, value: undefined} : trustedEntity(result, resolveEntity);
  if (!owner.ok) return owner;
  const output: Record<string, unknown> = {field: field.value, outputId: outputId.value, ...(owner.value === undefined ? {} : {entity: owner.value})};
  return {ok: true, value: {values: output as PresentationValues, fields: [field.value], ports: [{id: "filter", direction: "output", payload: "filter"}], operations: [AELIQO_OPERATION_REFS.filter]}};
}

function suggestTrend(needs: readonly Task["needs"][number][], result: Result | undefined): Outcome<PresentationValues> {
  if (result === undefined || result.fields.length === 0) return fail("suggestion", "A trend suggestion requires an authorized result descriptor.");
  const requested = new Set(needs.flatMap((need) => need.fields));
  const label = result.fields.find((field) => temporalField(field) && requested.has(field.id)) ?? result.fields.find((field) => temporalField(field));
  const series = result.fields.find((field) => numericField(field) && requested.has(field.id) && field.id !== label?.id)
    ?? result.fields.find((field) => numericField(field) && field.id !== label?.id);
  if (label === undefined || series === undefined) return fail("suggestion", "A trend suggestion requires a temporal field and numeric series field.");
  const seriesBy = result.rowGrain.filter((field) => field !== label.id && field !== series.id && requested.has(field));
  const grain = trendGrain(seriesBy, label.id, result); if (!grain.ok) return grain;
  return {ok: true, value: {labelField: label.id, series: [{field: series.id}], seriesBy}};
}

function suggestTable(needs: readonly Task["needs"][number][]): Outcome<PresentationValues> {
  const selection = needs.some((need) => need.operation.id === AELIQO_OPERATION_REFS.selection.id && need.operation.revision === AELIQO_OPERATION_REFS.selection.revision) ? "single" : "none";
  return {ok: true, value: {selection}};
}

function suggestFilter(needs: readonly Task["needs"][number][], result: Result | undefined): Outcome<PresentationValues> {
  const field = needs[0]?.fields[0] ?? result?.fields[0]?.id;
  const outputId = needs[0]?.outputId ?? result?.ref.outputId;
  if (field === undefined || outputId === undefined) return fail("suggestion", "A filter suggestion requires a named field and output.");
  return {ok: true, value: {field, outputId}};
}

function buildManifests(options: AeliqoPresentationRegistryOptions): readonly PresentationManifest[] {
  const resolveEntity = options.resolveEntity;
  return Object.freeze([
    {ref: AELIQO_PRESENTATION_REFS.stack, configSchema: AELIQO_CONFIG_SCHEMAS.stack, roles: ["structure"], operations: [], result: "none", children: {min: 0, max: 32}, visibility: "simultaneous", extension: false, resolveConfig: stackConfig, suggestConfig: (): Outcome<PresentationValues> => ({ok: true, value: {}})},
    {ref: AELIQO_PRESENTATION_REFS.table, configSchema: AELIQO_CONFIG_SCHEMAS.table, roles: ["table"], operations: [AELIQO_OPERATION_REFS.read, AELIQO_OPERATION_REFS.selection], result: "required", children: {min: 0, max: 0}, visibility: "leaf", extension: false, resolveConfig: (values, result) => tableConfig(values, result, resolveEntity), suggestConfig: suggestTable},
    {ref: AELIQO_PRESENTATION_REFS.trend, configSchema: AELIQO_CONFIG_SCHEMAS.trend, roles: ["trend", "chart"], operations: [AELIQO_OPERATION_REFS.read, AELIQO_OPERATION_REFS.compare], result: "required", children: {min: 0, max: 0}, visibility: "leaf", extension: false, resolveConfig: (values, result) => trendConfig(values, result), suggestConfig: suggestTrend},
    {ref: AELIQO_PRESENTATION_REFS.filter, configSchema: AELIQO_CONFIG_SCHEMAS.filter, roles: ["filter"], operations: [AELIQO_OPERATION_REFS.filter], result: "required", children: {min: 0, max: 0}, visibility: "leaf", extension: false, resolveConfig: (values, result) => filterConfig(values, result, resolveEntity), suggestConfig: suggestFilter},
  ]);
}

/** Default registry has no trusted entity bindings, so selection remains unavailable until the host supplies one. */
const defaultFoundation = createFoundationPresentationManifests();
if (!defaultFoundation.ok) throw new Error('Default foundation manifests are invalid.');
const defaultInputs = createInputPresentationManifests();
if (!defaultInputs.ok) throw new Error("Default input manifests are invalid.");
const defaultNavigationFeedback = createNavigationFeedbackPresentationManifests();
if (!defaultNavigationFeedback.ok) throw new Error("Default navigation/feedback manifests are invalid.");
const defaultData = createAeliqoDataPresentationManifests([]);
if (!defaultData.ok) throw new Error("Default data manifests are invalid.");
const defaultVisualizations = createAeliqoVisualizationPresentationManifests([]);
if (!defaultVisualizations.ok) throw new Error("Default visualization manifests are invalid.");
export const AELIQO_PRESENTATION_MANIFESTS: readonly PresentationManifest[] = Object.freeze([...buildManifests({}), ...defaultFoundation.value, ...defaultInputs.value, ...defaultNavigationFeedback.value, ...defaultData.value, ...defaultVisualizations.value]);

export function createSelectionIdentityMapping(entity: string, identity: readonly string[], grain: readonly string[] = identity): InteractionMappingManifest {
  const shape = {payload: "selection" as const, entity, identity: [...identity], grain: [...grain]};
  return {ref: {id: "selection.identity", revision: "1"}, source: shape, target: shape, kind: "identity"};
}

export function createAeliqoPresentationRegistry(options?: AeliqoPresentationRegistryOptions, mappings?: readonly InteractionMappingManifest[]): Outcome<PresentationRegistry>;
export function createAeliqoPresentationRegistry(mappings?: readonly InteractionMappingManifest[]): Outcome<PresentationRegistry>;
export function createAeliqoPresentationRegistry(
  optionsOrMappings: AeliqoPresentationRegistryOptions | readonly InteractionMappingManifest[] = {},
  mappings: readonly InteractionMappingManifest[] = [],
): Outcome<PresentationRegistry> {
  const isMappings = Array.isArray(optionsOrMappings);
  const options: AeliqoPresentationRegistryOptions = isMappings ? {} : optionsOrMappings as AeliqoPresentationRegistryOptions;
  const registeredMappings: readonly InteractionMappingManifest[] = isMappings ? optionsOrMappings as readonly InteractionMappingManifest[] : mappings;
  const foundation = createFoundationPresentationManifests(options.foundation);
  if (!foundation.ok) return foundation;
  const inputs = createInputPresentationManifests(options.inputs);
  if (!inputs.ok) return inputs;
  const navigationFeedback = createNavigationFeedbackPresentationManifests(options.navigationFeedback);
  if (!navigationFeedback.ok) return navigationFeedback;
  const data = createAeliqoDataPresentationManifests(options.data ?? [], options.resolveEntity === undefined ? {} : {resolveEntity: options.resolveEntity});
  if (!data.ok) return data;
  const visualizations=createAeliqoVisualizationPresentationManifests(options.visualizations??[],options.resolveEntity===undefined?{}:{resolveEntity:options.resolveEntity});
  if(!visualizations.ok)return visualizations;
  return createPresentationRegistry([...buildManifests(options), ...foundation.value, ...inputs.value, ...navigationFeedback.value, ...data.value, ...visualizations.value], registeredMappings);
}
