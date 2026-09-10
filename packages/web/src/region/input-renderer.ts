import {
  validateScalar,
  type InteractionPayload,
  type Scalar,
  type SemanticType,
  type ValidatedPresentation,
} from "@aeliqo/core";
import {html, nothing, type TemplateResult} from "lit";
import {repeat} from "lit/directives/repeat.js";
import {
  AeliqoFileChangeEvent,
  AeliqoFormSubmitEvent,
  AeliqoInputChangeEvent,
  AeliqoInputCommitEvent,
  AeliqoSearchEvent,
  type AeliqoFileChangeDetail,
  type AeliqoFormSubmitDetail,
  type AeliqoInputChangeDetail,
  type AeliqoInputCommitDetail,
} from "../input/events.js";

type Node = ValidatedPresentation["nodes"][number];
type DraftPayload = Extract<InteractionPayload, {readonly kind: "draft"}>;
type ActionPayload = Extract<InteractionPayload, {readonly kind: "action-request"}>;
type ExtensionPayload = Extract<InteractionPayload, {readonly kind: "extension"}>;

export type AeliqoInputEmit = (node: Node, portId: string, payload: InteractionPayload) => void;

export interface AeliqoInputInteraction {
  readonly portId: string;
  readonly payload: InteractionPayload;
}

const record = (value: unknown): Record<string, unknown> | undefined =>
  value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
const text = (value: unknown, fallback = ""): string => typeof value === "string" ? value : fallback;
const bool = (value: unknown): boolean => value === true;
const bounded = (value: unknown, max = 512, required = true): value is string =>
  typeof value === "string" && value.length <= max && (!required || value.length > 0) && !/[\u0000-\u001f\u007f]/u.test(value);
const exactKeys = (value: Record<string, unknown>, allowed: readonly string[]): boolean => Object.keys(value).every((key) => allowed.includes(key));

function semanticType(value: unknown): value is SemanticType {
  const candidate = record(value);
  if (candidate === undefined || !exactKeys(candidate, ["value", "nullable", "unit", "grain", "temporal"]) ||
    !["text", "boolean", "integer", "float", "decimal", "date", "instant"].includes(String(candidate.value)) || typeof candidate.nullable !== "boolean") return false;
  if (candidate.unit !== undefined) {
    const unit = record(candidate.unit);
    if (unit === undefined || !exactKeys(unit, ["dimension", "symbol", "currency"]) || !bounded(unit.dimension, 160) || !bounded(unit.symbol, 160) || (unit.currency !== undefined && !bounded(unit.currency, 160))) return false;
  }
  if (candidate.grain !== undefined && (!Array.isArray(candidate.grain) || candidate.grain.some((item) => !bounded(item, 160)) || new Set(candidate.grain).size !== candidate.grain.length)) return false;
  if (candidate.temporal !== undefined) {
    const temporal = record(candidate.temporal);
    if (temporal === undefined || !exactKeys(temporal, ["calendar", "timezone", "grain"]) || !bounded(temporal.calendar, 160) || (temporal.timezone !== undefined && !bounded(temporal.timezone, 160)) || (temporal.grain !== undefined && !bounded(temporal.grain, 160)) || !["date", "instant"].includes(String(candidate.value))) return false;
  }
  return true;
}

function eventBoundary(event: Event, constructor: Function, type: string): boolean {
  return event.type === type && event instanceof (constructor as {new (...args: never[]): Event}) && event.bubbles && event.composed;
}

function changeDetail(event: Event): AeliqoInputChangeDetail<unknown> | undefined {
  if (!eventBoundary(event, AeliqoInputChangeEvent, "aeliqo-input-change")) return undefined;
  const detail = (event as AeliqoInputChangeEvent<unknown>).detail;
  if (record(detail) === undefined || !exactKeys(detail as unknown as Record<string, unknown>, ["source", "value", "composing"]) || detail.source !== "user" || detail.composing === true) return undefined;
  return detail;
}

function commitDetail(event: Event): AeliqoInputCommitDetail<unknown> | undefined {
  if (!eventBoundary(event, AeliqoInputCommitEvent, "aeliqo-input-commit")) return undefined;
  const detail = (event as AeliqoInputCommitEvent<unknown>).detail;
  if (record(detail) === undefined || !exactKeys(detail as unknown as Record<string, unknown>, ["source", "value"]) || detail.source !== "user") return undefined;
  return detail;
}

function searchDetail(event: Event): string | undefined {
  if (!eventBoundary(event, AeliqoSearchEvent, "aeliqo-search")) return undefined;
  const detail = (event as AeliqoSearchEvent).detail;
  if (record(detail) === undefined || !exactKeys(detail as unknown as Record<string, unknown>, ["source", "query"]) || detail.source !== "user" || !bounded(detail.query, 16_384, false)) return undefined;
  return detail.query;
}

function submitDetail(event: Event): AeliqoFormSubmitDetail | undefined {
  if (!eventBoundary(event, AeliqoFormSubmitEvent, "aeliqo-form-submit")) return undefined;
  const detail = (event as AeliqoFormSubmitEvent).detail;
  if (record(detail) === undefined || !exactKeys(detail as unknown as Record<string, unknown>, ["source", "submitter"]) || detail.source !== "user" || (detail.submitter !== undefined && !bounded(detail.submitter, 256))) return undefined;
  return detail;
}

function fileDetail(event: Event): AeliqoFileChangeDetail | undefined {
  if (!eventBoundary(event, AeliqoFileChangeEvent, "aeliqo-file-change")) return undefined;
  const detail = (event as AeliqoFileChangeEvent).detail;
  if (record(detail) === undefined || !exactKeys(detail as unknown as Record<string, unknown>, ["source", "files"]) || detail.source !== "user" || !Array.isArray(detail.files) || detail.files.length > 500) return undefined;
  for (const item of detail.files) {
    const file = record(item);
    if (file === undefined || !exactKeys(file, ["name", "size", "type", "lastModified"]) || !bounded(file.name, 512) || !bounded(file.type, 256, false) || typeof file.size !== "number" || !Number.isSafeInteger(file.size) || file.size < 0 || typeof file.lastModified !== "number" || !Number.isSafeInteger(file.lastModified) || file.lastModified < 0) return undefined;
  }
  return detail;
}

function validRef(value: unknown): value is {readonly id: string; readonly revision: string} {
  const candidate = record(value);
  return candidate !== undefined && Object.keys(candidate).length === 2 && bounded(candidate.id, 160) && bounded(candidate.revision, 160);
}

function scalarType(value: unknown): SemanticType | undefined {
  const candidate = record(value);
  if (!semanticType(candidate)) return undefined;
  return candidate as SemanticType;
}

function scalarValue(value: unknown): boolean {
  if (value === null || typeof value === "string" || typeof value === "boolean") return true;
  if (typeof value === "number") return Number.isFinite(value);
  const candidate = record(value);
  return candidate !== undefined && Object.keys(candidate).length === 1 && typeof candidate.decimal === "string" && candidate.decimal.length <= 512 && /^-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?$/u.test(candidate.decimal);
}

function numberScalar(raw: unknown, type: SemanticType): Scalar | undefined {
  if (typeof raw !== "string" || !/^[+-]?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?$/u.test(raw)) return undefined;
  const candidate: unknown = type.value === "decimal" ? {decimal: raw} : Number(raw);
  const checked = validateScalar(candidate, type);
  return checked.ok ? checked.value : undefined;
}

function scalar(raw: unknown, type: SemanticType, numericText = false): Scalar | undefined {
  if (numericText) return numberScalar(raw, type);
  const checked = validateScalar(raw, type);
  return checked.ok ? checked.value : undefined;
}

/** Compare semantic types by their declared members rather than object serialization. */
function sameSemanticType(left: SemanticType, right: SemanticType): boolean {
  if (left.value !== right.value || left.nullable !== right.nullable) return false;
  const leftUnit = left.unit;
  const rightUnit = right.unit;
  if (leftUnit === undefined || rightUnit === undefined) {
    if (leftUnit !== rightUnit) return false;
  } else if (leftUnit.dimension !== rightUnit.dimension || leftUnit.symbol !== rightUnit.symbol || leftUnit.currency !== rightUnit.currency) return false;
  const leftGrain = left.grain ?? [];
  const rightGrain = right.grain ?? [];
  if (leftGrain.length !== rightGrain.length || leftGrain.some((item, index) => item !== rightGrain[index])) return false;
  const leftTemporal = left.temporal;
  const rightTemporal = right.temporal;
  if (leftTemporal === undefined || rightTemporal === undefined) return leftTemporal === rightTemporal;
  return leftTemporal.calendar === rightTemporal.calendar && leftTemporal.timezone === rightTemporal.timezone && leftTemporal.grain === rightTemporal.grain;
}

type DecimalNumber = {readonly coefficient: bigint; readonly scale: number};

/** Parse bounded decimal text/number values for exact bound and step checks. */
function decimalNumber(value: unknown): DecimalNumber | undefined {
  const textValue = typeof value === "number" && Number.isFinite(value) ? String(value) : value;
  if (typeof textValue !== "string" || textValue.length === 0 || textValue.length > 512) return undefined;
  const matched = /^([+-])?(?:(\d+)(?:\.(\d*))?|\.(\d+))(?:[eE]([+-]?\d+))?$/u.exec(textValue);
  if (matched === null) return undefined;
  const whole = matched[2] ?? "0";
  const fraction = matched[3] ?? matched[4] ?? "";
  const exponent = Number(matched[5] ?? "0");
  if (!Number.isSafeInteger(exponent) || Math.abs(exponent) > 1024) return undefined;
  const sign = matched[1] === "-" ? -1n : 1n;
  let coefficient = BigInt(`${whole}${fraction}` || "0") * sign;
  let scale = fraction.length - exponent;
  if (scale < 0) {
    coefficient *= 10n ** BigInt(-scale);
    scale = 0;
  }
  return {coefficient, scale};
}

function decimalCompare(left: DecimalNumber, right: DecimalNumber): -1 | 0 | 1 {
  const scale = Math.max(left.scale, right.scale);
  const a = left.coefficient * 10n ** BigInt(scale - left.scale);
  const b = right.coefficient * 10n ** BigInt(scale - right.scale);
  return a < b ? -1 : a > b ? 1 : 0;
}

function decimalOnStep(value: DecimalNumber, minimum: DecimalNumber | undefined, step: DecimalNumber | undefined): boolean {
  if (step === undefined) return true;
  if (step.coefficient <= 0n) return false;
  const base = minimum ?? {coefficient: 0n, scale: 0};
  const scale = Math.max(value.scale, base.scale, step.scale);
  const delta = value.coefficient * 10n ** BigInt(scale - value.scale) - base.coefficient * 10n ** BigInt(scale - base.scale);
  const increment = step.coefficient * 10n ** BigInt(scale - step.scale);
  return delta % increment === 0n;
}

function boundedStep(value: unknown, minimum: unknown, maximum: unknown, step: unknown): boolean {
  const parsed = decimalNumber(value);
  const min = minimum === undefined || minimum === "" ? undefined : decimalNumber(minimum);
  const max = maximum === undefined || maximum === "" ? undefined : decimalNumber(maximum);
  const increment = step === undefined || step === "" ? undefined : decimalNumber(step);
  if (parsed === undefined || (minimum !== undefined && minimum !== "" && min === undefined) || (maximum !== undefined && maximum !== "" && max === undefined) || (step !== undefined && step !== "" && increment === undefined)) return false;
  if (min !== undefined && decimalCompare(parsed, min) < 0) return false;
  if (max !== undefined && decimalCompare(parsed, max) > 0) return false;
  return decimalOnStep(parsed, min, increment);
}

function port(node: Node, id: string, payload: InteractionPayload["kind"]): boolean {
  return node.config.ports.some((candidate) => candidate.id === id && candidate.payload === payload);
}

function draftFrom(node: Node, binding: Record<string, unknown>, raw: unknown, numericText = false, portId = "draft"): DraftPayload | undefined {
  const entity = text(binding.entity);
  const key = text(binding.key);
  const field = text(binding.field);
  const entityRevision = text(binding.entityRevision);
  const type = scalarType(binding.type);
  if (!bounded(entity, 160) || !bounded(key, 512) || !bounded(field, 160) || !bounded(entityRevision, 160) || type === undefined) return undefined;
  const declaredPort = node.config.ports.find((candidate) => candidate.id === portId && candidate.payload === "draft");
  if (declaredPort?.type === undefined || !sameSemanticType(declaredPort.type, type)) return undefined;
  const value = scalar(raw, type, numericText);
  return value === undefined ? undefined : {kind: "draft", entity, key, field, value, entityRevision};
}

function interactionForDraft(node: Node, event: Event): readonly AeliqoInputInteraction[] {
  const values = node.config.values as Record<string, unknown>;
  const binding = values;
  const ref = node.manifest.id;
  const commit = commitDetail(event);
  const change = changeDetail(event);
  const search = ref === "input.search-field" ? searchDetail(event) : undefined;
  let raw: unknown;
  let numericText = false;
  if (ref === "input.number-field") {
    const detail = commit?.value;
    const candidate = record(detail);
    if (candidate === undefined || !exactKeys(candidate, ["text", "value", "valid"]) || candidate.valid !== true || typeof candidate.value !== "string") return [];
    if (!boundedStep(candidate.value, binding.min, binding.max, binding.step)) return [];
    raw = candidate.value; numericText = true;
  } else if (ref === "input.slider") {
    const detail = commit?.value;
    const candidate = record(detail);
    if (candidate === undefined || !exactKeys(candidate, ["value", "unit"]) || typeof candidate.value !== "number" || !Number.isFinite(candidate.value)) return [];
    const unit = text(binding.unit);
    const registeredUnit = scalarType(binding.type)?.unit?.symbol;
    if (candidate.unit !== unit || (registeredUnit !== undefined && registeredUnit !== candidate.unit) || (registeredUnit === undefined && candidate.unit !== "")) return [];
    // The shared slider element uses these defaults when the reviewed binding
    // omits a bound or increment; validate against the same effective values.
    const minimum = binding.min === undefined ? 0 : binding.min;
    const maximum = binding.max === undefined ? 100 : binding.max;
    const step = binding.step === undefined ? 1 : binding.step;
    if (!boundedStep(candidate.value, minimum, maximum, step)) return [];
    raw = candidate.value;
  } else if (ref === "input.search-field" && search !== undefined) {
    raw = search;
  } else if (["input.text-field", "input.text-area", "input.date-field"].includes(ref)) {
    if (commit === undefined) return [];
    raw = commit.value;
  } else if (ref === "input.combobox") {
    if (change === undefined || typeof change.value !== "string" || change.value.length === 0) return [];
    raw = change.value;
  } else {
    if (change === undefined) return [];
    raw = change.value;
  }
  if (!port(node, "draft", "draft")) return [];
  const payload = draftFrom(node, binding, raw, numericText);
  return payload === undefined ? [] : [{portId: "draft", payload}];
}

function interactionForRange(node: Node, event: Event): readonly AeliqoInputInteraction[] {
  const detail = commitDetail(event)?.value;
  const candidate = record(detail);
  if (candidate === undefined || !exactKeys(candidate, ["start", "end", "boundary", "timezone", "calendar", "valid"]) || candidate.valid !== true || typeof candidate.start !== "string" || typeof candidate.end !== "string") return [];
  const values = node.config.values as Record<string, unknown>;
  if (candidate.boundary !== (values.boundary ?? "inclusive") || candidate.timezone !== (values.timezone ?? "calendar") || candidate.calendar !== (values.calendar ?? "gregory")) return [];
  const range = record(values.range);
  const start = range === undefined ? undefined : record(range.start);
  const end = range === undefined ? undefined : record(range.end);
  if (start === undefined || end === undefined) return [];
  const startPayload = draftFrom(node, start, candidate.start, false, "start");
  const endPayload = draftFrom(node, end, candidate.end, false, "end");
  if (startPayload === undefined || endPayload === undefined || !port(node, "start", "draft") || !port(node, "end", "draft")) return [];
  return [{portId: "start", payload: startPayload}, {portId: "end", payload: endPayload}];
}

function interactionForForm(node: Node, event: Event): readonly AeliqoInputInteraction[] {
  if (submitDetail(event) === undefined || !port(node, "submit", "action-request")) return [];
  const values = node.config.values as Record<string, unknown>;
  const action = values.action;
  if (!validRef(action)) return [];
  const operations = node.config.operations;
  if (!Array.isArray(operations) || !operations.some((operation) => validRef(operation) && operation.id === action.id && operation.revision === action.revision)) return [];
  const actionInput = record(values.actionInput);
  if (actionInput === undefined) return [];
  const input: Record<string, unknown> = actionInput;
  if (!Object.keys(input).every((key) => bounded(key, 160) && scalarValue(input[key]))) return [];
  const payload: ActionPayload = {kind: "action-request", action, input: input as ActionPayload["input"]};
  return [{portId: "submit", payload}];
}

function interactionForFile(node: Node, event: Event): readonly AeliqoInputInteraction[] {
  const detail = fileDetail(event);
  const values = node.config.values as Record<string, unknown>;
  const schema = values.fileSchema;
  if (detail === undefined || !validRef(schema) || !port(node, "files", "extension")) return [];
  const extension = node.config.ports.find((candidate) => candidate.id === "files" && candidate.payload === "extension")?.extension;
  if (extension === undefined || extension.id !== schema.id || extension.revision !== schema.revision) return [];
  const files = detail.files.map((file) => ({name: file.name, size: file.size, type: file.type, lastModified: file.lastModified}));
  const payload: ExtensionPayload = {kind: "extension", schema, value: {files}};
  return [{portId: "files", payload}];
}

/** Validate a typed input event against the registered node binding. No model or host effect is invoked. */
export function resolveInputInteraction(node: Node, event: Event): readonly AeliqoInputInteraction[] {
  switch (node.manifest.id) {
    case "input.date-range": return interactionForRange(node, event);
    case "input.form": return interactionForForm(node, event);
    case "input.file-input": return interactionForFile(node, event);
    case "input.field-group": return [];
    default: return interactionForDraft(node, event);
  }
}

function common(node: Node): Record<string, unknown> {
  return node.config.values as Record<string, unknown>;
}

function eventHandler(node: Node, emit: AeliqoInputEmit): (event: Event) => void {
  return (event) => {
    for (const interaction of resolveInputInteraction(node, event)) emit(node, interaction.portId, interaction.payload);
  };
}

/** Render one of the registered input primitives. Tags and event names are fixed by this adapter. */
export function renderInputNode(node: Node, child: (id: string) => unknown, emit: AeliqoInputEmit, locale = "en-US"): TemplateResult | typeof nothing | undefined {
  const v = common(node);
  const id = node.node.id;
  const children = () => repeat(node.node.children, (childId) => childId, (childId) => child(childId));
  const handle = eventHandler(node, emit);
  const label = text(v.label);
  const description = text(v.description);
  const required = bool(v.required);
  const disabled = bool(v.disabled);
  const readOnly = bool(v.readOnly);
  const name = text(v.name);
  switch (node.manifest.id) {
    case "input.text-field": return html`<aeliqo-text-field data-aeliqo-node-id=${id} data-aeliqo-theme="inherit" .label=${label} .description=${description} .required=${required} .disabled=${disabled} .readOnly=${readOnly} .name=${name} .value=${text(v.value)} .defaultValue=${text(v.defaultValue)} .placeholder=${text(v.placeholder)} .autocomplete=${text(v.autocomplete)} .inputType=${text(v.inputType, "text")} @aeliqo-input-commit=${handle}></aeliqo-text-field>`;
    case "input.text-area": return html`<aeliqo-text-area data-aeliqo-node-id=${id} data-aeliqo-theme="inherit" .label=${label} .description=${description} .required=${required} .disabled=${disabled} .readOnly=${readOnly} .name=${name} .value=${text(v.value)} .defaultValue=${text(v.defaultValue)} .rows=${typeof v.rows === "number" ? v.rows : 4} @aeliqo-input-commit=${handle}></aeliqo-text-area>`;
    case "input.number-field": return html`<aeliqo-number-field .locale=${locale} data-aeliqo-node-id=${id} data-aeliqo-theme="inherit" .label=${label} .description=${description} .required=${required} .disabled=${disabled} .readOnly=${readOnly} .name=${name} .value=${typeof v.value === "string" ? v.value : undefined} .defaultValue=${text(v.defaultValue)} .min=${text(v.min)} .max=${text(v.max)} .step=${text(v.step)} .unit=${text(v.unit)} @aeliqo-input-commit=${handle}></aeliqo-number-field>`;
    case "input.checkbox": return html`<aeliqo-checkbox data-aeliqo-node-id=${id} data-aeliqo-theme="inherit" .label=${label} .description=${description} .required=${required} .disabled=${disabled} .readOnly=${readOnly} .name=${name} .checked=${bool(v.checked)} .defaultChecked=${bool(v.defaultChecked)} .indeterminate=${bool(v.indeterminate)} .value=${text(v.value, "on")} @aeliqo-input-change=${handle}></aeliqo-checkbox>`;
    case "input.radio-group": return html`<aeliqo-radio-group data-aeliqo-node-id=${id} data-aeliqo-theme="inherit" .label=${label} .description=${description} .required=${required} .disabled=${disabled} .readOnly=${readOnly} .name=${name} .options=${Array.isArray(v.options) ? v.options : []} .value=${text(v.value)} .defaultValue=${text(v.defaultValue)} .orientation=${v.orientation === "horizontal" ? "horizontal" : "vertical"} @aeliqo-input-change=${handle}></aeliqo-radio-group>`;
    case "input.switch": return html`<aeliqo-switch data-aeliqo-node-id=${id} data-aeliqo-theme="inherit" .label=${label} .description=${description} .required=${required} .disabled=${disabled} .readOnly=${readOnly} .name=${name} .checked=${bool(v.checked)} .defaultChecked=${bool(v.defaultChecked)} .value=${text(v.value, "on")} @aeliqo-input-change=${handle}></aeliqo-switch>`;
    case "input.select": return html`<aeliqo-select data-aeliqo-node-id=${id} data-aeliqo-theme="inherit" .label=${label} .description=${description} .required=${required} .disabled=${disabled} .readOnly=${readOnly} .name=${name} .options=${Array.isArray(v.options) ? v.options : []} .value=${text(v.value)} .defaultValue=${text(v.defaultValue)} .emptyLabel=${text(v.emptyLabel, "Select an option")} @aeliqo-input-change=${handle}></aeliqo-select>`;
    case "input.combobox": return html`<aeliqo-combobox data-aeliqo-node-id=${id} data-aeliqo-theme="inherit" .label=${label} .description=${description} .required=${required} .disabled=${disabled} .readOnly=${readOnly} .name=${name} .options=${Array.isArray(v.options) ? v.options : []} .value=${text(v.value)} .defaultValue=${text(v.defaultValue)} .query=${text(v.query)} .minQueryLength=${typeof v.minQueryLength === "number" ? v.minQueryLength : 0} .placeholder=${text(v.placeholder)} @aeliqo-input-change=${handle}></aeliqo-combobox>`;
    case "input.date-field": return html`<aeliqo-date-field data-aeliqo-node-id=${id} data-aeliqo-theme="inherit" .label=${label} .description=${description} .required=${required} .disabled=${disabled} .readOnly=${readOnly} .name=${name} .value=${text(v.value)} .defaultValue=${text(v.defaultValue)} .min=${text(v.min)} .max=${text(v.max)} .calendar=${v.calendar === "gregory" ? "gregory" : "gregory"} @aeliqo-input-commit=${handle}></aeliqo-date-field>`;
    case "input.date-range": return html`<aeliqo-date-range data-aeliqo-node-id=${id} data-aeliqo-theme="inherit" .label=${label} .description=${description} .required=${required} .disabled=${disabled} .readOnly=${readOnly} .name=${name} .start=${text(v.start)} .end=${text(v.end)} .defaultStart=${text(v.defaultStart)} .defaultEnd=${text(v.defaultEnd)} .boundary=${v.boundary === "exclusive" ? "exclusive" : "inclusive"} .timezone="calendar" .calendar="gregory" @aeliqo-input-commit=${handle}></aeliqo-date-range>`;
    case "input.slider": return html`<aeliqo-slider data-aeliqo-node-id=${id} data-aeliqo-theme="inherit" .label=${label} .description=${description} .required=${required} .disabled=${disabled} .readOnly=${readOnly} .name=${name} .value=${typeof v.value === "number" ? v.value : 0} .defaultValue=${typeof v.defaultValue === "number" ? v.defaultValue : 0} .min=${typeof v.min === "number" ? v.min : 0} .max=${typeof v.max === "number" ? v.max : 100} .step=${typeof v.step === "number" ? v.step : 1} .unit=${text(v.unit)} @aeliqo-input-commit=${handle}></aeliqo-slider>`;
    case "input.search-field": return html`<aeliqo-search-field data-aeliqo-node-id=${id} data-aeliqo-theme="inherit" .label=${label} .description=${description} .required=${required} .disabled=${disabled} .readOnly=${readOnly} .name=${name} .value=${text(v.value)} .defaultValue=${text(v.defaultValue)} .placeholder=${text(v.placeholder)} .autocomplete=${text(v.autocomplete)} .queryOnInput=${bool(v.queryOnInput)} .debounceMs=${typeof v.debounceMs === "number" ? v.debounceMs : 250} @aeliqo-input-commit=${handle} @aeliqo-search=${handle}></aeliqo-search-field>`;
    case "input.file-input": return html`<aeliqo-file-input data-aeliqo-node-id=${id} data-aeliqo-theme="inherit" .label=${label} .description=${description} .required=${required} .disabled=${disabled} .readOnly=${readOnly} .name=${name} .accept=${text(v.accept)} .multiple=${bool(v.multiple)} .capture=${text(v.capture)} .maxFiles=${typeof v.maxFiles === "number" ? v.maxFiles : 0} .maxBytes=${typeof v.maxBytes === "number" ? v.maxBytes : 0} @aeliqo-file-change=${handle}></aeliqo-file-input>`;
    case "input.field-group": return html`<aeliqo-field-group data-aeliqo-node-id=${id} data-aeliqo-theme="inherit" .legend=${text(v.legend)} .description=${description} .error=${text(v.error)} .disabled=${disabled}>${children()}</aeliqo-field-group>`;
    case "input.form": return html`<aeliqo-form data-aeliqo-node-id=${id} data-aeliqo-theme="inherit" .label=${text(v.label)} .noValidate=${bool(v.noValidate)} @aeliqo-form-submit=${handle}>${children()}</aeliqo-form>`;
    default: return undefined;
  }
}
