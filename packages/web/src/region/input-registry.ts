import {
  parseWireValue,
  validateScalar,
  type InteractionPort,
  type Outcome,
  type PresentationManifest,
  type PresentationValues,
  type Scalar,
  type SemanticType,
  type VersionRef,
} from "@aeliqo/core";
import {
  AELIQO_INPUT_REFS,
  type AeliqoInputId,
  type AeliqoInputRef,
} from "../input/manifest.js";
import type {AeliqoOption} from "../input/options.js";

/** A host reviewed semantic target for one draft-producing control. */
export interface AeliqoInputDraftBinding {
  readonly entity: string;
  readonly key: string;
  readonly field: string;
  readonly entityRevision: string;
  readonly type: SemanticType;
}

/** A host reviewed, immutable form action. Input values are static parameters; drafts stay host-owned. */
export interface AeliqoInputActionBinding {
  readonly action: VersionRef;
  readonly input: Readonly<Record<string, Scalar>>;
}

/** A registered schema for metadata-only file selections. */
export interface AeliqoInputFileBinding {
  readonly schema: VersionRef;
}

/**
 * One application-owned input binding. The presentation graph contains only
 * `bindingRef` and `bindingRevision`; labels, options, semantic targets,
 * defaults and effects are copied from this reviewed table.
 */
export interface AeliqoInputBinding {
  readonly id: string;
  readonly ref: AeliqoInputRef;
  readonly config: Readonly<Record<string, unknown>>;
  readonly draft?: AeliqoInputDraftBinding;
  readonly range?: {
    readonly start: AeliqoInputDraftBinding;
    readonly end: AeliqoInputDraftBinding;
  };
  readonly action?: AeliqoInputActionBinding;
  readonly file?: AeliqoInputFileBinding;
}

/** Immutable host bindings captured by an Experience revision. */
export interface AeliqoInputBindings {
  readonly revision: string;
  readonly inputs: readonly AeliqoInputBinding[];
}

const CONFIG_SCHEMAS = Object.freeze(Object.fromEntries(
  Object.values(AELIQO_INPUT_REFS).map((ref) => [ref.id, {id: `${ref.id}.config`, revision: "1"}]),
)) as Record<AeliqoInputId, VersionRef>;

const fail = <T>(code: string, message: string): Outcome<T> => ({ok: false,
  diagnostics: [{code: `web.input.${code}`, message, retryable: false}]});

const record = (value: unknown): Record<string, unknown> | undefined =>
  value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined;

const boundedText = (value: unknown, max = 512, required = false): value is string =>
  typeof value === "string" && value.length <= max && (!required || value.length > 0) &&
  !/[\u0000-\u001f\u007f]/u.test(value);

const boundedId = (value: unknown, required = true): value is string => boundedText(value, 160, required);

const exactKeys = (value: Record<string, unknown>, allowed: readonly string[]): boolean =>
  Object.keys(value).every((key) => allowed.includes(key));

const versionRef = (value: unknown): value is VersionRef => {
  const candidate = record(value);
  return candidate !== undefined && Object.keys(candidate).length === 2 &&
    boundedId(candidate.id) && boundedText(candidate.revision, 160, true);
};

const semanticType = (value: unknown): value is SemanticType => {
  const candidate = record(value);
  if (candidate === undefined || !exactKeys(candidate, ["value", "nullable", "unit", "grain", "temporal"]) ||
    !["text", "boolean", "integer", "float", "decimal", "date", "instant"].includes(String(candidate.value)) ||
    typeof candidate.nullable !== "boolean") return false;
  if (candidate.unit !== undefined) {
    const unit = record(candidate.unit);
    if (unit === undefined || !exactKeys(unit, ["dimension", "symbol", "currency"]) || !boundedId(unit.dimension) || !boundedText(unit.symbol, 160, true) || (unit.currency !== undefined && !boundedId(unit.currency))) return false;
  }
  if (candidate.grain !== undefined && (!Array.isArray(candidate.grain) || candidate.grain.some((item) => !boundedId(item)) || new Set(candidate.grain).size !== candidate.grain.length)) return false;
  if (candidate.temporal !== undefined) {
    const temporal = record(candidate.temporal);
    if (temporal === undefined || !exactKeys(temporal, ["calendar", "timezone", "grain"]) || !boundedId(temporal.calendar) || (temporal.timezone !== undefined && !boundedId(temporal.timezone)) || (temporal.grain !== undefined && !boundedId(temporal.grain)) || !["date", "instant"].includes(String(candidate.value))) return false;
  }
  return true;
};

const scalarRecord = (value: unknown): value is Readonly<Record<string, Scalar>> => {
  const candidate = record(value);
  return candidate !== undefined && Object.keys(candidate).length <= 128 &&
    Object.keys(candidate).every((key) => boundedId(key) && scalarValue(candidate[key]));
};

function scalarValue(value: unknown): value is Scalar {
  if (value === null || typeof value === "string" || typeof value === "boolean") return true;
  if (typeof value === "number") return Number.isFinite(value);
  const candidate = record(value);
  return candidate !== undefined && Object.keys(candidate).length === 1 &&
    typeof candidate.decimal === "string" && /^-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?$/u.test(candidate.decimal) && candidate.decimal.length <= 512;
}

function clone<T>(value: T): T {
  if (value !== null && typeof value === "object") {
    for (const child of Object.values(value as Record<string, unknown>)) clone(child);
    Object.freeze(value);
  }
  return value;
}

function copyJson(value: unknown): unknown {
  const parsed = parseWireValue(value);
  if (!parsed.ok) return undefined;
  // `inspectWire` returns the inspected value. Copy every JSON node before the
  // snapshot is frozen so caller-owned nested config/ref/type objects are not
  // frozen in place.
  const copy = (candidate: unknown): unknown => {
    if (candidate === null || typeof candidate !== "object") return candidate;
    if (Array.isArray(candidate)) return candidate.map((item) => copy(item));
    const output: Record<string, unknown> = {};
    for (const key of Object.keys(candidate)) output[key] = copy((candidate as Record<string, unknown>)[key]);
    return output;
  };
  return copy(parsed.value);
}

function optionList(value: unknown): value is readonly AeliqoOption[] {
  if (!Array.isArray(value) || value.length === 0 || value.length > 500) return false;
  const seen = new Set<string>();
  return value.every((item) => {
    const option = record(item);
    if (option === undefined || !exactKeys(option, ["value", "label", "description", "disabled"]) ||
      !boundedText(option.value, 256, true) || !boundedText(option.label, 512, true) || seen.has(option.value)) return false;
    if (option.description !== undefined && !boundedText(option.description, 1024)) return false;
    if (option.disabled !== undefined && typeof option.disabled !== "boolean") return false;
    seen.add(option.value);
    return true;
  });
}

function numericText(value: unknown): boolean {
  return value === undefined || (typeof value === "string" && value.length <= 512 &&
    /^(?:[+-]?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?)?$/u.test(value));
}

function finiteNumber(value: unknown, minimum = -Number.MAX_SAFE_INTEGER, maximum = Number.MAX_SAFE_INTEGER): boolean {
  return value === undefined || (typeof value === "number" && Number.isFinite(value) && value >= minimum && value <= maximum);
}

function dateValue(value: unknown): boolean {
  if (value === undefined || value === "") return true;
  if (!boundedText(value, 10, true) || !/^\d{4}-\d{2}-\d{2}$/u.test(value)) return false;
  const parsed = Date.parse(`${value}T00:00:00Z`);
  return Number.isFinite(parsed) && new Date(parsed).toISOString().slice(0, 10) === value;
}

function commonConfig(value: Record<string, unknown>, keys: readonly string[], requireLabel = true, includeCommon = true): boolean {
  const allowed = includeCommon ? ["label", "description", "required", "disabled", "readOnly", "name", ...keys] : keys;
  if (!exactKeys(value, allowed)) return false;
  if (!includeCommon) return true;
  const checks = [requireLabel ? boundedText(value.label, 512, true) : (value.label === undefined || boundedText(value.label, 512)), value.description === undefined || boundedText(value.description, 2048), value.required === undefined || typeof value.required === "boolean", value.disabled === undefined || typeof value.disabled === "boolean", value.readOnly === undefined || typeof value.readOnly === "boolean", value.name === undefined || boundedText(value.name, 128)];
  return checks.every(Boolean);
}

function typeValue(type: SemanticType, value: unknown, allowEmpty = true): Outcome<Scalar | undefined> {
  if (value === undefined) return {ok: true, value: undefined};
  if (allowEmpty && value === "") return {ok: true, value: ""};
  const checked = validateScalar(value, type);
  return checked.ok ? checked : fail("binding", "A bound default/value does not satisfy its registered semantic type.");
}

function numberValue(type: SemanticType, value: unknown): Outcome<Scalar | undefined> {
  if (value === undefined || value === "") return {ok: true, value: undefined};
  if (typeof value !== "string" || !/^[+-]?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?$/u.test(value)) return fail("binding", "Number values must be canonical numeric text.");
  const candidate: unknown = type.value === "decimal" ? {decimal: value} : Number(value);
  return typeValue(type, candidate, false);
}

function fieldBinding(value: unknown, path: string): Outcome<AeliqoInputDraftBinding> {
  const field = record(value);
  if (field === undefined || !exactKeys(field, ["entity", "key", "field", "entityRevision", "type"]) ||
    !boundedId(field.entity) || !boundedText(field.key, 512, true) || !boundedId(field.field) ||
    !boundedText(field.entityRevision, 160, true) || !semanticType(field.type))
    return fail("binding", `${path} must be a complete registered semantic field binding.`);
  return {ok: true, value: clone({entity: field.entity, key: field.key, field: field.field, entityRevision: field.entityRevision, type: field.type})};
}

function validateInputBinding(binding: AeliqoInputBinding): Outcome<AeliqoInputBinding> {
  const config = record(binding.config);
  if (!boundedId(binding.id) || config === undefined || !versionRef(binding.ref) ||
    !Object.values(AELIQO_INPUT_REFS).some((ref) => ref.id === binding.ref.id && ref.revision === binding.ref.revision))
    return fail("binding", "An input binding has an invalid identifier or primitive reference.");
  const ref = binding.ref.id as AeliqoInputId;
  const draftRefs = new Set(["input.text-field", "input.text-area", "input.number-field", "input.checkbox", "input.radio-group", "input.switch", "input.select", "input.combobox", "input.date-field", "input.slider", "input.search-field"]);
  const draft = binding.draft === undefined ? undefined : fieldBinding(binding.draft, "draft");
  if (draft !== undefined && !draft.ok) return draft;
  const range = binding.range;
  const start = range === undefined ? undefined : fieldBinding(range.start, "range.start");
  const end = range === undefined ? undefined : fieldBinding(range.end, "range.end");
  if (start !== undefined && !start.ok) return start;
  if (end !== undefined && !end.ok) return end;
  const draftValue = draft?.ok === true ? draft.value : undefined;
  const startValue = start?.ok === true ? start.value : undefined;
  const endValue = end?.ok === true ? end.value : undefined;
  if (draftRefs.has(ref) && draftValue === undefined) return fail("binding", `${ref} requires a registered draft target.`);
  if (ref === "input.date-range" && (startValue === undefined || endValue === undefined)) return fail("binding", "A date range requires registered start and end field mappings.");
  if (ref !== "input.date-range" && range !== undefined) return fail("binding", "Only a date range may declare two field mappings.");
  if (ref === "input.date-range" && (startValue!.type.value !== "date" || endValue!.type.value !== "date")) return fail("binding", "Date range mappings must use the date semantic type.");
  if (ref === "input.date-range" && (startValue!.entity !== endValue!.entity || startValue!.key !== endValue!.key || startValue!.entityRevision !== endValue!.entityRevision)) return fail("binding", "Date range start and end mappings must target the same registered entity revision.");
  if (ref !== "input.date-range" && draftValue !== undefined && ["input.number-field", "input.slider"].includes(ref) && !["integer", "float", "decimal"].includes(draftValue.type.value)) return fail("binding", `${ref} requires a numeric semantic type.`);
  if (ref !== "input.date-field" && ref !== "input.date-range" && draftValue !== undefined && ref !== "input.number-field" && ref !== "input.slider" && ref !== "input.checkbox" && ref !== "input.switch" && draftValue.type.value !== "text") return fail("binding", `${ref} requires a text semantic type.`);
  if (["input.checkbox", "input.switch"].includes(ref) && draftValue !== undefined && draftValue.type.value !== "boolean") return fail("binding", `${ref} requires a boolean semantic type.`);
  if (ref === "input.date-field" && draftValue !== undefined && draftValue.type.value !== "date") return fail("binding", "A date field requires the date semantic type.");
  const has = (key: string): boolean => Object.hasOwn(config, key);
  const stringField = (key: string, max: number): boolean => !has(key) || boundedText(config[key], max);
  const boolField = (key: string): boolean => !has(key) || typeof config[key] === "boolean";
  const enumField = (key: string, allowed: readonly string[]): boolean => !has(key) || typeof config[key] === "string" && allowed.includes(config[key]);
  const textDraft = draftValue;
  const valueCheck = (key: string): Outcome<Scalar | undefined> => typeValue(textDraft?.type ?? {value: "text", nullable: false}, config[key]);
  const numberCheck = (key: string): Outcome<Scalar | undefined> => numberValue(textDraft?.type ?? {value: "float", nullable: false}, config[key]);
  const allowedByRef: Record<AeliqoInputId, readonly string[]> = {
    "input.text-field": ["value", "defaultValue", "placeholder", "autocomplete", "inputType"],
    "input.text-area": ["value", "defaultValue", "rows"],
    "input.number-field": ["value", "defaultValue", "min", "max", "step", "unit"],
    "input.checkbox": ["checked", "defaultChecked", "indeterminate", "value"],
    "input.radio-group": ["value", "defaultValue", "orientation", "options"],
    "input.switch": ["checked", "defaultChecked", "value"],
    "input.select": ["value", "defaultValue", "emptyLabel", "options"],
    "input.combobox": ["value", "defaultValue", "query", "minQueryLength", "placeholder", "options"],
    "input.date-field": ["value", "defaultValue", "min", "max", "calendar"],
    "input.date-range": ["start", "end", "defaultStart", "defaultEnd", "boundary", "timezone", "calendar"],
    "input.slider": ["value", "defaultValue", "min", "max", "step", "unit"],
    "input.search-field": ["value", "defaultValue", "queryOnInput", "debounceMs", "placeholder", "autocomplete"],
    "input.file-input": ["accept", "multiple", "capture", "maxFiles", "maxBytes"],
    "input.field-group": ["legend", "description", "error", "disabled"],
    "input.form": ["label", "noValidate"],
  };
  const structure = ref === "input.field-group" || ref === "input.form";
  if (!commonConfig(config, allowedByRef[ref], ref !== "input.field-group", !structure)) return fail("binding", `${ref} contains an unknown or malformed common configuration field.`);
  if (ref === "input.text-field" && (!stringField("value", 16_384) || !stringField("defaultValue", 16_384) || !stringField("placeholder", 1_024) || !stringField("autocomplete", 128) || !enumField("inputType", ["text", "search", "url", "tel", "email", "password", "date", "month", "week", "time", "datetime-local", "number"]))) return fail("binding", "Text field configuration is invalid.");
  if (ref === "input.text-area" && (!stringField("value", 65_536) || !stringField("defaultValue", 65_536) || !finiteNumber(config.rows, 1, 100))) return fail("binding", "Text area configuration is invalid.");
  if (ref === "input.number-field" && (!numericText(config.value) || !numericText(config.defaultValue) || !numericText(config.min) || !numericText(config.max) || !numericText(config.step) || !stringField("unit", 128))) return fail("binding", "Number field configuration is invalid.");
  if (["input.checkbox", "input.switch"].includes(ref) && (!boolField("checked") || !boolField("defaultChecked") || !boolField("indeterminate") || !stringField("value", 256))) return fail("binding", "Boolean control configuration is invalid.");
  if (["input.radio-group", "input.select", "input.combobox"].includes(ref) && (!stringField("value", 256) || !stringField("defaultValue", 256) || !optionList(config.options))) return fail("binding", `${ref} requires a bounded registered option list.`);
  if (ref === "input.radio-group" && !enumField("orientation", ["horizontal", "vertical"])) return fail("binding", "Radio orientation is invalid.");
  if (ref === "input.select" && !stringField("emptyLabel", 256)) return fail("binding", "Select emptyLabel is invalid.");
  if (ref === "input.combobox" && (!stringField("query", 1_024) || !finiteNumber(config.minQueryLength, 0, 256) || !stringField("placeholder", 1_024))) return fail("binding", "Combobox configuration is invalid.");
  if (ref === "input.date-field" && (!stringField("value", 10) || !stringField("defaultValue", 10) || !dateValue(config.value) || !dateValue(config.defaultValue) || !dateValue(config.min) || !dateValue(config.max) || !enumField("calendar", ["gregory"]))) return fail("binding", "Date field configuration is invalid.");
  if (ref === "input.date-range" && (!dateValue(config.start) || !dateValue(config.end) || !dateValue(config.defaultStart) || !dateValue(config.defaultEnd) || !enumField("boundary", ["inclusive", "exclusive"]) || !enumField("timezone", ["calendar"]) || !enumField("calendar", ["gregory"]))) return fail("binding", "Date range configuration is invalid.");
  if (ref === "input.slider" && (!finiteNumber(config.value) || !finiteNumber(config.defaultValue) || !finiteNumber(config.min) || !finiteNumber(config.max) || !finiteNumber(config.step, Number.MIN_VALUE) || !stringField("unit", 128))) return fail("binding", "Slider configuration is invalid.");
  if (ref === "input.search-field" && (!stringField("value", 16_384) || !stringField("defaultValue", 16_384) || !boolField("queryOnInput") || !finiteNumber(config.debounceMs, 0, 10_000) || !stringField("placeholder", 1_024) || !stringField("autocomplete", 128))) return fail("binding", "Search field configuration is invalid.");
  if (ref === "input.file-input" && (!stringField("accept", 1_024) || !boolField("multiple") || !stringField("capture", 64) || !finiteNumber(config.maxFiles, 0, 500) || !finiteNumber(config.maxBytes, 0, 1_000_000_000))) return fail("binding", "File input configuration is invalid.");
  if (ref === "input.field-group" && (!stringField("legend", 512) || !stringField("description", 2_048) || !stringField("error", 2_048) || !boolField("disabled"))) return fail("binding", "Field group configuration is invalid.");
  if (ref === "input.form" && (!stringField("label", 512) || !boolField("noValidate"))) return fail("binding", "Form configuration is invalid.");
  if (textDraft !== undefined) {
    for (const key of ["value", "defaultValue"]) {
      if (ref === "input.number-field") { const checked = numberCheck(key); if (!checked.ok) return checked; }
      else if (["input.text-field", "input.text-area", "input.search-field", "input.date-field", "input.radio-group", "input.select", "input.combobox"].includes(ref)) { const checked = valueCheck(key); if (!checked.ok) return checked; }
    }
  }
  if (ref === "input.date-range" && (config.start !== undefined && !dateValue(config.start) || config.end !== undefined && !dateValue(config.end))) return fail("binding", "Date range values must be valid calendar dates.");
  if (ref === "input.slider" && draftValue !== undefined) {
    const unit = draftValue.type.unit?.symbol;
    if (unit === undefined ? config.unit !== undefined && config.unit !== "" : config.unit !== unit) return fail("binding", "Slider unit must match the registered semantic unit exactly.");
    for (const key of ["value", "defaultValue", "min", "max", "step"]) {
      if (config[key] === undefined) continue;
      if (typeof config[key] !== "number" || !Number.isFinite(config[key])) return fail("binding", "Slider numeric bounds must be finite numbers.");
      if (draftValue.type.value === "integer" && !Number.isSafeInteger(config[key])) return fail("binding", "An integer slider requires safe integer values.");
      if (!validateScalar(config[key], draftValue.type).ok) return fail("binding", "A slider value or bound does not satisfy its registered semantic type.");
    }
  }
  if (ref === "input.number-field" && draftValue !== undefined) {
    const unit = draftValue.type.unit?.symbol;
    if (unit === undefined ? config.unit !== undefined && config.unit !== "" : config.unit !== unit) return fail("binding", "Number field unit must match the registered semantic unit exactly.");
    for (const key of ["value", "defaultValue", "min", "max", "step"]) {
      if (config[key] === undefined || config[key] === "") continue;
      if (!numberValue(draftValue.type, config[key]).ok) return fail("binding", `Number field ${key} does not satisfy its registered semantic type.`);
    }
  }
  if (binding.action !== undefined) {
    if (!versionRef(binding.action.action) || !scalarRecord(binding.action.input)) return fail("binding", "A registered action must contain a versioned action and scalar static parameters.");
  }
  if (ref === "input.form" && binding.action === undefined) return fail("binding", "A form requires a host-registered action.");
  if (ref !== "input.form" && binding.action !== undefined) return fail("binding", "Only a form may declare an action binding.");
  if (binding.file !== undefined && !versionRef(binding.file.schema)) return fail("binding", "A file input requires a registered metadata schema.");
  if (ref === "input.file-input" && binding.file === undefined) return fail("binding", "A file input requires a registered metadata schema.");
  if (ref !== "input.file-input" && binding.file !== undefined) return fail("binding", "Only a file input may declare a metadata schema.");
  const copied = copyJson({id: binding.id, ref: binding.ref, config, ...(draft === undefined ? {} : {draft: draft.value}), ...(range === undefined ? {} : {range: {start: start!.value, end: end!.value}}), ...(binding.action === undefined ? {} : {action: binding.action}), ...(binding.file === undefined ? {} : {file: binding.file})});
  if (copied === undefined) return fail("binding", "An input binding must be bounded JSON data.");
  return {ok: true, value: clone(copied as AeliqoInputBinding)};
}

function copyBindings(input: AeliqoInputBindings | undefined): Outcome<AeliqoInputBindings> {
  if (input === undefined) return {ok: true, value: {revision: "unconfigured", inputs: []}};
  const copied = copyJson(input);
  const value = record(copied);
  if (value === undefined || !boundedText(value.revision, 160, true) || !Array.isArray(value.inputs) || value.inputs.length > 128) return fail("binding", "Input bindings require a bounded revision and input list.");
  const ids = new Set<string>();
  const entries: AeliqoInputBinding[] = [];
  for (const item of value.inputs) {
    const candidate = record(item);
    if (candidate === undefined || ids.has(String(candidate.id))) return fail("binding", "Input binding identifiers must be unique.");
    const checked = validateInputBinding(candidate as unknown as AeliqoInputBinding);
    if (!checked.ok) return checked;
    ids.add(checked.value.id); entries.push(checked.value);
  }
  return {ok: true, value: clone({revision: value.revision, inputs: entries})};
}

function bindingValues(binding: AeliqoInputBinding): Outcome<PresentationValues> {
  const config = record(binding.config)!;
  const output: Record<string, unknown> = {...config, bindingRef: binding.id};
  if (binding.draft !== undefined) Object.assign(output, binding.draft);
  if (binding.range !== undefined) output.range = binding.range;
  if (binding.action !== undefined) { output.action = binding.action.action; output.actionInput = binding.action.input; }
  if (binding.file !== undefined) output.fileSchema = binding.file.schema;
  return {ok: true, value: output as PresentationValues};
}

function draftPort(binding: AeliqoInputDraftBinding, id = "draft"): InteractionPort {
  return {id, direction: "output", payload: "draft", entity: binding.entity, type: binding.type};
}

function manifestFor(ref: AeliqoInputRef, bindings: AeliqoInputBindings): PresentationManifest {
  const entries = bindings.inputs.filter((entry) => entry.ref.id === ref.id);
  const operations = ref.id === "input.form" ? entries.flatMap((entry) => entry.action === undefined ? [] : [entry.action.action]) : [];
  const children = ref.id === "input.field-group" || ref.id === "input.form" ? {min: 0, max: 32} : {min: 0, max: 0};
  const portsFor = (binding: AeliqoInputBinding): readonly InteractionPort[] => {
    if (binding.range !== undefined) return [draftPort(binding.range.start, "start"), draftPort(binding.range.end, "end")];
    if (binding.draft !== undefined) return [draftPort(binding.draft)];
    if (binding.action !== undefined) return [{id: "submit", direction: "output", payload: "action-request"}];
    if (binding.file !== undefined) return [{id: "files", direction: "output", payload: "extension", extension: binding.file.schema}];
    return [];
  };
  return {
    ref,
    configSchema: CONFIG_SCHEMAS[ref.id],
    roles: [ref.id === "input.field-group" || ref.id === "input.form" ? "structure" : "input"],
    operations: [...new Map(operations.map((operation) => [JSON.stringify(operation), operation])).values()],
    result: "none",
    children,
    visibility: children.max > 0 ? "simultaneous" : "leaf",
    extension: false,
    resolveConfig(values) {
      const candidate = record(values);
      if (candidate === undefined || !exactKeys(candidate, ["bindingRef", "bindingRevision"]) ||
        !boundedId(candidate.bindingRef) || candidate.bindingRevision !== bindings.revision) return fail("config", "Input nodes must reference the pinned host binding revision and a registered binding identifier.");
      const binding = entries.find((entry) => entry.id === candidate.bindingRef);
      if (binding === undefined) return fail("binding", "The requested input binding is not registered for this primitive.");
      const checked = validateInputBinding(binding); if (!checked.ok) return checked;
      const resolved = bindingValues(checked.value); if (!resolved.ok) return resolved;
      const output = {...resolved.value, bindingRevision: bindings.revision};
      return {ok: true, value: {values: output as PresentationValues, fields: [], ports: portsFor(binding), operations: binding.action === undefined ? [] : [binding.action.action]}};
    },
  };
}

/** Build the registered semantic input manifests from an immutable host binding table. */
export function createInputPresentationManifests(input?: AeliqoInputBindings): Outcome<readonly PresentationManifest[]> {
  const copied = copyBindings(input); if (!copied.ok) return copied;
  return {ok: true, value: Object.freeze(Object.values(AELIQO_INPUT_REFS).map((ref) => Object.freeze(manifestFor(ref, copied.value))))};
}
