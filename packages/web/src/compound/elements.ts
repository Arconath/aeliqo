import {css, html, nothing, type PropertyValues} from "lit";
import type {ResultRef, Scalar, VersionRef, VisualizationBindingContext, VisualizationSpec} from "@aeliqo/sdk-core";
import {AeliqoCompoundElement, aeliqoCompoundThemeStyles} from "./base.js";
import {stableDataRecordKey, stableDataValueKey} from "../data/shared.js";
import type {
  AeliqoBreakdownGroup, AeliqoBreakdownGroupDetail, AeliqoComparisonMetric, AeliqoComparisonSetDetail, AeliqoCompoundStatus, AeliqoFormFlowCommitDetail, AeliqoFormFlowStep,
  AeliqoFormFlowStepDetail,
  AeliqoRecordEditorCancelDetail, AeliqoRecordEditorSaveDetail, AeliqoQualityState,
} from "./types.js";
import type {AeliqoDataColumn, AeliqoDataRecord, AeliqoDataScope, AeliqoFieldOption, AeliqoFilterPredicate} from "../data/types.js";
import type {VisualizationDataset} from "../visualization/types.js";
import type {AeliqoFilterChangeDetail, AeliqoSelectionDetail} from "../data/types.js";
import type {AeliqoTableColumn, AeliqoTableRow, TableCell} from "../types.js";
import {AeliqoFormElement} from "../input/form.js";

const statusValues = ["ready", "loading", "empty", "partial", "stale", "error", "unavailable"] as const;
type Status = typeof statusValues[number];
const status = (value: unknown): Status => typeof value === "string" && (statusValues as readonly string[]).includes(value) ? value as Status : "ready";
const event = <T>(type: string, detail: T, cancelable = true): CustomEvent<T> => new CustomEvent(type, {bubbles: true, composed: true, cancelable, detail: Object.freeze(detail)});
const MAX_COMPARISON_KEYS = 32;
const MAX_COMPARISON_METRICS = 64;
const MAX_BREAKDOWN_GROUPS = 100;
const bounded = <T>(items: readonly T[], maximum: number): readonly T[] => items.slice(0, maximum);

function tableCell(value: Scalar | undefined): TableCell {
  if (value === undefined) return "Not available";
  if (value === null || typeof value === "string" || typeof value === "number" || typeof value === "boolean") return value;
  if (typeof value === "object" && !Array.isArray(value) && typeof value.decimal === "string") return {decimal: value.decimal};
  return "Not available";
}

type CompoundControl = HTMLElement & {
  readonly name?: string;
  readonly value?: unknown;
  readonly formValue?: string | File | FormData | null;
  checkValidity?: () => boolean;
  reportValidity?: () => boolean;
};

type CompoundWireValue = string | readonly string[];
type FormDraftValue = Scalar | readonly Scalar[];
type FormDraftRecord = Record<string, FormDraftValue>;

function nullRecord<T>(): Record<string, T> {
  return Object.create(null) as Record<string, T>;
}

function isDisabledControl(control: CompoundControl): boolean {
  return control.matches(":disabled") || control.closest("fieldset:disabled") !== null;
}

function fileName(value: unknown): string | undefined {
  return typeof File !== "undefined" && value instanceof File ? value.name : undefined;
}

function appendWireValue(output: Record<string, CompoundWireValue>, name: string, raw: unknown): void {
  if (raw === undefined || raw === null || name.length === 0) return;
  if (typeof FormData !== "undefined" && raw instanceof FormData) {
    for (const [key, value] of raw.entries()) appendWireValue(output, key, value);
    return;
  }
  if (Array.isArray(raw)) {
    for (const value of raw) appendWireValue(output, name, value);
    return;
  }
  const value = fileName(raw) ?? String(raw);
  const existing = output[name];
  if (existing === undefined) output[name] = value;
  else output[name] = [...(Array.isArray(existing) ? existing : [existing]), value];
}

function appendDraftValue(output: FormDraftRecord, name: string, raw: unknown): void {
  if (raw === undefined || raw === null || name.length === 0) return;
  if (typeof FormData !== "undefined" && raw instanceof FormData) {
    for (const [key, value] of raw.entries()) appendDraftValue(output, key, value);
    return;
  }
  if (Array.isArray(raw)) {
    for (const value of raw) appendDraftValue(output, name, value);
    return;
  }
  const value = fileName(raw) ?? raw;
  if (typeof value !== "string" && typeof value !== "number" && typeof value !== "boolean" && typeof value !== "object") return;
  const existing = output[name];
  if (existing === undefined) output[name] = value as Scalar;
  else output[name] = [...(Array.isArray(existing) ? existing : [existing]), value as Scalar];
}

/** DateRange exposes its named FormData through ElementInternals; retain the
 * public boundary values too because ElementInternals does not expose them
 * through the component's formValue receipt. */
function dateRangeParts(control: CompoundControl, name: string): readonly [string, string] | undefined {
  if (control.localName !== "aeliqo-date-range" || control.checkValidity?.() === false) return undefined;
  const start = (control as HTMLElement & {readonly start?: unknown}).start;
  const end = (control as HTMLElement & {readonly end?: unknown}).end;
  return typeof start === "string" && start.length > 0 && typeof end === "string" && end.length > 0 ? [
    `${name}[start]`, start,
  ] as const : undefined;
}

function compoundControls(host: HTMLElement): readonly CompoundControl[] {
  return Array.from(host.querySelectorAll<HTMLElement>("input, select, textarea, button, aeliqo-input, aeliqo-text-field, aeliqo-text-area, aeliqo-number-field, aeliqo-date-field, aeliqo-date-range, aeliqo-search-field, aeliqo-checkbox, aeliqo-switch, aeliqo-radio-group, aeliqo-select, aeliqo-combobox, aeliqo-slider, aeliqo-file-input"))
    .filter((control): control is CompoundControl => control.closest("aeliqo-record-editor, aeliqo-form-flow") === host);
}

function collectCompoundValues(host: HTMLElement): Readonly<Record<string, string | readonly string[]>> {
  const output = nullRecord<CompoundWireValue>();
  for (const control of compoundControls(host)) {
    const name = control.getAttribute("name") || control.name || "";
    if (!name || isDisabledControl(control) || control instanceof HTMLButtonElement || (control instanceof HTMLInputElement && ["submit", "reset", "button", "image"].includes(control.type))) continue;
    if (control instanceof HTMLInputElement && ["checkbox", "radio"].includes(control.type) && !control.checked) continue;
    if (control instanceof HTMLSelectElement && control.multiple) {
      appendWireValue(output, name, [...control.selectedOptions].map(option => option.value));
      continue;
    }
    const range = dateRangeParts(control, name);
    if (range !== undefined) {
      appendWireValue(output, range[0], range[1]);
      const end = (control as HTMLElement & {readonly end?: string}).end;
      if (typeof end === "string") appendWireValue(output, `${name}[end]`, end);
    } else appendWireValue(output, name, "formValue" in control ? control.formValue : control.value);
  }
  return output;
}

function reportCompoundValidity(host: HTMLElement): boolean {
  const controls = compoundControls(host);
  let valid = true;
  for (const control of controls) {
    if (isDisabledControl(control)) continue;
    const check = control.reportValidity ?? control.checkValidity;
    if (check !== undefined && !check.call(control)) valid = false;
  }
  return valid;
}

export class AeliqoExplorerElement extends AeliqoCompoundElement {
  static readonly properties = {
    fields: {attribute: false}, predicate: {attribute: false}, rows: {attribute: false}, columns: {attribute: false}, identity: {attribute: false}, entity: {type: String}, selectedKey: {attribute: "selected-key", type: String}, detailRecord: {attribute: false}, detailFields: {attribute: false}, result: {attribute: false}, scope: {attribute: false}, status: {type: String}, message: {type: String}, title: {type: String}, filterLabel: {attribute: "filter-label", type: String}, collectionLabel: {attribute: "collection-label", type: String}, detailLabel: {attribute: "detail-label", type: String}, selection: {type: String},
  };
  static readonly styles = [...aeliqoCompoundThemeStyles, css`[part="panels"] { display: grid; gap: var(--aeliqo-space-24, 1.5rem); grid-template-columns: minmax(12rem, .7fr) minmax(16rem, 1.3fr); } @media (max-width: 48rem) { [part="panels"] { grid-template-columns: 1fr; } }`];
  fields: readonly AeliqoFieldOption[] = []; predicate: AeliqoFilterPredicate | undefined; rows: readonly AeliqoDataRecord[] = []; columns: readonly AeliqoDataColumn[] = []; identity: readonly string[] = []; entity = "record"; selectedKey = ""; detailRecord: AeliqoDataRecord | undefined; detailFields: readonly AeliqoDataColumn[] = []; result: ResultRef | undefined; scope: AeliqoDataScope | undefined; status: AeliqoCompoundStatus = "ready"; message = ""; title = "Explore"; filterLabel = "Filter"; collectionLabel = "Records"; detailLabel = "Selected detail"; selection: "none" | "single" | "multiple" = "single";
  protected override render() {
    const current = status(this.status); const detail = this.detailRecord ?? this.rows.find(row => this.rowKey(row) === this.selectedKey); const statusText = this.statusTemplate(current, this.message);
    return html`<section part="root" data-status=${current} aria-label=${this.title}><div part="header"><h2>${this.title}</h2>${this.scope ? html`<span part="scope">${this.scopeLabel(this.scope)}</span>` : nothing}</div><div part="panels"><section part="filter" aria-label=${this.filterLabel}><h3>${this.filterLabel}</h3><aeliqo-filter-builder .fields=${this.fields} .predicate=${this.predicate} .entity=${this.entity} .status=${current} @aeliqo-filter-change=${this.forwardFilter}></aeliqo-filter-builder></section><section part="collection" aria-label=${this.collectionLabel}><h3>${this.collectionLabel}</h3><aeliqo-record-list .rows=${this.rows} .columns=${this.columns} .identity=${this.identity} .entity=${this.entity} .selectedKeys=${this.selectedKey ? [this.selectedKey] : []} .result=${this.result} .scope=${this.scope} .selection=${this.selection} .status=${current} @aeliqo-record-list-selection=${this.forwardSelection}></aeliqo-record-list></section><section part="detail"><h3>${this.detailLabel}</h3><aeliqo-detail .title=${this.detailLabel} .record=${detail} .fields=${this.detailFields.length ? this.detailFields : this.columns} .identity=${this.identity} .entity=${this.entity} .scope=${this.scope} .status=${current}></aeliqo-detail></section></div>${statusText ? html`<p part="status" role="status">${statusText}</p>` : nothing}</section>`;
  }
  private rowKey(row: AeliqoDataRecord): string | undefined { return stableDataRecordKey(row, this.identity); }
  private readonly forwardFilter = (raw: Event): void => { const detail = (raw as CustomEvent<AeliqoFilterChangeDetail>).detail; if (detail) this.dispatchEvent(event("aeliqo-explorer-filter", detail)); };
  private readonly forwardSelection = (raw: Event): void => { const detail = (raw as CustomEvent<AeliqoSelectionDetail>).detail; if (detail) this.dispatchEvent(event("aeliqo-explorer-selection", detail)); };
}

export class AeliqoComparisonElement extends AeliqoCompoundElement {
  static readonly properties = {compareKeys: {attribute: false}, compareSet: {attribute: false}, metrics: {attribute: false}, entity: {type: String}, status: {type: String}, message: {type: String}, title: {type: String}, result: {attribute: false}, scope: {attribute: false}, identity: {attribute: false}, compatible: {type: Boolean}, selectedKey: {attribute: "selected-key", type: String}};
  static readonly styles = [...aeliqoCompoundThemeStyles, css`[part="table"] { max-inline-size: 100%; overflow-x: auto; }`];
  compareKeys: readonly string[] = []; compareSet: readonly {readonly key: string; readonly label?: string}[] = []; metrics: readonly AeliqoComparisonMetric[] = []; entity = "record"; status: AeliqoCompoundStatus = "ready"; message = ""; title = "Comparison"; result: ResultRef | undefined; scope: AeliqoDataScope | undefined; identity: readonly string[] = []; compatible = true; selectedKey = "";
  protected override render() {
    const requestedKeys = this.compareKeys.length ? this.compareKeys : bounded(this.compareSet, MAX_COMPARISON_KEYS).map(item => item.key);
    const overflow = (this.compareKeys.length || this.compareSet.length) > MAX_COMPARISON_KEYS;
    const keys = [...new Set(bounded(requestedKeys, MAX_COMPARISON_KEYS))];
    const metrics = bounded(this.metrics, MAX_COMPARISON_METRICS);
    const labels = new Map(bounded(this.compareSet, MAX_COMPARISON_KEYS).map(item => [item.key, item.label ?? item.key]));
    const selectedKeys = new Set(keys);
    const columns: readonly AeliqoTableColumn[] = [{key: "metric", label: "Metric"}, ...keys.map(key => ({key: `comparison:${key}`, label: labels.get(key) ?? key}))];
    const rows: readonly AeliqoTableRow[] = metrics.map(metric => ({
      metricId: metric.id,
      metric: metric.unit ? `${metric.label} (${metric.unit})` : metric.label,
      ...Object.fromEntries(keys.map(key => [`comparison:${key}`, tableCell(metric.values[key])])),
    }));
    const current = status(this.status);
    const boundedNotice = overflow || this.metrics.length > metrics.length;
    return html`<section part="root" data-status=${current} aria-label=${this.title}>
      <div part="header"><h2>${this.title}</h2>${this.scope ? html`<span part="scope">${this.scopeLabel(this.scope)}</span>` : nothing}</div>
      ${!this.compatible ? html`<p part="status" role="alert">These metrics cannot be compared because their units or grain are incompatible.</p>` : html`
        <div part="actions" aria-label="Compare set">${keys.map(key => html`<button part="compare-button" type="button" ?disabled=${overflow} aria-pressed=${String(selectedKeys.has(key))} @click=${() => this.requestCompare(key)}>${labels.get(key) ?? key}</button>`)}</div>
        <div part="table" role="region" aria-label="Simultaneous comparison"><aeliqo-table .caption=${`${this.title}: ${keys.length} ${this.entity}${keys.length === 1 ? "" : "s"}`} .columns=${columns} .rows=${rows} .identity=${["metricId"]} .result=${this.result} .scope=${this.scope} status=${current}></aeliqo-table></div>
        ${boundedNotice ? html`<p part="hint">Showing a bounded comparison window. Narrow the compare set to edit it.</p>` : nothing}
      `}
      ${current !== "ready" ? html`<p part="status" role="status">${this.statusText(current, this.message)}</p>` : nothing}
    </section>`;
  }
  private readonly requestCompare = (key: string): void => {
    if ((this.compareKeys.length || this.compareSet.length) > MAX_COMPARISON_KEYS) return;
    const current = [...new Set(this.compareKeys.length ? this.compareKeys : this.compareSet.map(item => item.key))];
    const next = current.includes(key) ? current.filter(item => item !== key) : [...current, key];
    if (next.length === 0) return;
    this.dispatchEvent(event<AeliqoComparisonSetDetail>("aeliqo-comparison-set", {source: "user", entity: this.entity, keys: next, ...(this.result === undefined ? {} : {result: this.result}), ...(this.scope === undefined ? {} : {scope: this.scope})}));
  };
}

export class AeliqoBreakdownElement extends AeliqoCompoundElement {
  static readonly properties = {groups: {attribute: false}, rows: {attribute: false}, columns: {attribute: false}, identity: {attribute: false}, entity: {type: String}, groupLabel: {attribute: "group-label", type: String}, metricLabel: {attribute: "metric-label", type: String}, result: {attribute: false}, scope: {attribute: false}, status: {type: String}, message: {type: String}, title: {type: String}, selectedGroup: {attribute: "selected-group", type: String}};
  static readonly styles = [...aeliqoCompoundThemeStyles, css`[part="table"] { max-inline-size: 100%; overflow-x: auto; }`];
  groups: readonly AeliqoBreakdownGroup[] = []; rows: readonly AeliqoDataRecord[] = []; columns: readonly AeliqoDataColumn[] = []; identity: readonly string[] = []; entity = "record"; groupLabel = "Group"; metricLabel = "Metric"; result: ResultRef | undefined; scope: AeliqoDataScope | undefined; status: AeliqoCompoundStatus = "ready"; message = ""; title = "Breakdown"; selectedGroup = "";
  protected override render() {
    const current = status(this.status);
    const groups = bounded(this.groups, MAX_BREAKDOWN_GROUPS);
    const tableColumns: readonly AeliqoTableColumn[] = [
      {key: "group", label: this.groupLabel},
      {key: "metric", label: this.metricLabel},
      {key: "records", label: "Records"},
    ];
    const tableRows: readonly AeliqoTableRow[] = groups.map(group => ({
      groupKey: group.key,
      group: group.label,
      metric: group.displayValue ?? tableCell(group.value),
      records: group.recordCount === undefined ? "Not available" : group.recordCount,
    }));
    const selectedKey = this.selectedGroup.length > 0 ? stableDataValueKey(this.selectedGroup) : undefined;
    return html`
      <section part="root" data-status=${current} aria-label=${this.title}>
        <div part="header"><h2>${this.title}</h2>${this.scope ? html`<span part="scope">${this.scopeLabel(this.scope)}</span>` : nothing}</div>
        <div part="table"><aeliqo-table .caption=${`${this.title}: grouped ${this.entity} data`} .columns=${tableColumns} .rows=${tableRows} .identity=${["groupKey"]} .selectedKeys=${selectedKey ? [selectedKey] : []} .selection=${"single"} .result=${this.result} .scope=${this.scope} status=${current} @aeliqo-table-selection=${this.forwardGroupSelection}></aeliqo-table></div>
        ${this.groups.length > groups.length ? html`<p part="hint">Showing a bounded group window.</p>` : nothing}
        ${this.selectedGroup ? html`<section part="detail" aria-label="Contributing records"><h3>Contributing records</h3><aeliqo-record-list .rows=${this.rows} .columns=${this.columns} .identity=${this.identity} .entity=${this.entity} .result=${this.result} .scope=${this.scope} selection="none"></aeliqo-record-list></section>` : nothing}
        ${current !== "ready" ? html`<p part="status" role="status">${this.statusText(current, this.message)}</p>` : nothing}
      </section>
    `;
  }
  private readonly forwardGroupSelection = (raw: Event): void => {
    const detail = (raw as CustomEvent<AeliqoSelectionDetail>).detail;
    if (!detail || detail.mode !== "ids" || detail.keys.length === 0) return;
    const group = this.groups.find(candidate => stableDataValueKey(candidate.key) === detail.keys[0]);
    if (group === undefined) return;
    this.dispatchEvent(event<AeliqoBreakdownGroupDetail>("aeliqo-breakdown-group", {source: "user", key: group.key, entity: this.entity, ...(this.result === undefined ? {} : {result: this.result}), ...(this.scope === undefined ? {} : {scope: this.scope})}));
  };
}

export class AeliqoInvestigationElement extends AeliqoCompoundElement {
  static readonly properties = {trendContext: {attribute: false}, trendDatasets: {attribute: false}, eventContext: {attribute: false}, eventDatasets: {attribute: false}, trend: {attribute: false}, baseline: {attribute: false}, events: {attribute: false}, detailRecord: {attribute: false}, detailFields: {attribute: false}, result: {attribute: false}, eventResult: {attribute: false}, identity: {attribute: false}, entity: {type: String}, scope: {attribute: false}, status: {type: String}, message: {type: String}, title: {type: String}, label: {type: String}};
  static readonly styles = [...aeliqoCompoundThemeStyles, css`[part="caution"] { border-inline-start: .25rem solid var(--aeliqo-color-warning, #b54708); padding-inline-start: var(--aeliqo-space-12, .75rem); }`];
  trendContext: VisualizationBindingContext = {results: []}; trendDatasets: readonly VisualizationDataset[] = []; eventContext: VisualizationBindingContext = {results: []}; eventDatasets: readonly VisualizationDataset[] = []; trend: VisualizationSpec | undefined; baseline: Scalar | undefined; events: VisualizationSpec | undefined; detailRecord: AeliqoDataRecord | undefined; detailFields: readonly AeliqoDataColumn[] = []; result: ResultRef | undefined; eventResult: ResultRef | undefined; identity: readonly string[] = []; entity = "record"; scope: AeliqoDataScope | undefined; status: AeliqoCompoundStatus = "ready"; message = ""; title = "Investigation"; label = "Trend";
  protected override render() { const current = status(this.status); return html`<section part="root" data-status=${current} aria-label=${this.title}><div part="header"><h2>${this.title}</h2>${this.scope ? html`<span part="scope">${this.scopeLabel(this.scope)}</span>` : nothing}</div><div part="grid"><section part="trend" aria-label="Trend"><h3>${this.label}</h3>${this.trend ? html`<aeliqo-trend .visualization=${this.trend} .context=${this.trendContext} .datasets=${this.trendDatasets}></aeliqo-trend>` : html`<p part="hint">No trend is available.</p>`}</section><section part="baseline" aria-label="Baseline"><h3>Baseline</h3><aeliqo-metric label="Baseline" .value=${this.baseline}></aeliqo-metric></section><section part="events" aria-label="Event timeline"><h3>Event timeline</h3>${this.events ? html`<aeliqo-timeline .visualization=${this.events} .context=${this.eventContext} .datasets=${this.eventDatasets}></aeliqo-timeline>` : html`<p part="hint">No events are available.</p>`}</section><section part="detail"><h3>Detail</h3><aeliqo-detail .title=${"Investigation detail"} .record=${this.detailRecord} .fields=${this.detailFields} .identity=${this.identity} .entity=${this.entity} .scope=${this.scope} .status=${current}></aeliqo-detail></section></div><p part="caution">Associations are displayed as evidence in the selected scope. They do not establish causal claims.</p>${current !== "ready" ? html`<p part="status" role="status">${this.statusText(current, this.message)}</p>` : nothing}</section>`; }
}

export class AeliqoSearchResultsElement extends AeliqoCompoundElement {
  static readonly styles = [...aeliqoCompoundThemeStyles];
  static readonly properties = {detailRecord: {attribute: false}, detailFields: {attribute: false}, query: {type: String}, queryRevision: {attribute: "query-revision", type: String}, resultRevision: {attribute: "result-revision", type: String}, rows: {attribute: false}, columns: {attribute: false}, identity: {attribute: false}, result: {attribute: false}, scope: {attribute: false}, selectedKey: {attribute: "selected-key", type: String}, entity: {type: String}, status: {type: String}, message: {type: String}, title: {type: String}, count: {type: Number}};
  detailRecord: AeliqoDataRecord | undefined; detailFields: readonly AeliqoDataColumn[] = []; query = ""; queryRevision = ""; resultRevision = ""; rows: readonly AeliqoDataRecord[] = []; columns: readonly AeliqoDataColumn[] = []; identity: readonly string[] = []; result: ResultRef | undefined; scope: AeliqoDataScope | undefined; selectedKey = ""; entity = "result"; status: AeliqoCompoundStatus = "ready"; message = ""; title = "Search results"; count: number | undefined;
  protected override render() {
    const stale = this.queryRevision.length > 0 && this.queryRevision !== this.resultRevision;
    const current = stale ? "stale" : status(this.status);
    const total = this.count ?? this.scope?.filteredTotal;
    return html`
      <section part="root" data-status=${current} aria-label=${this.title}>
        <div part="header"><h2>${this.title}</h2><span part="query">${this.query ? `Results for “${this.query}”` : "Enter a search query"}</span></div>
        ${stale ? html`<p part="status" role="status">Results are out of date for this query. Refresh to view them.</p>` : html`
          <p part="scope">${total === undefined ? "Matching count unavailable" : `${total.toLocaleString()} matching results`}</p>
          <aeliqo-card-collection .rows=${this.rows} .columns=${this.columns} .identity=${this.identity} .entity=${this.entity} .selectedKeys=${this.selectedKey ? [this.selectedKey] : []} .result=${this.result} .scope=${this.scope} selection="single" @aeliqo-card-selection=${this.forwardSelection}></aeliqo-card-collection>
          ${this.detailRecord ? html`<aeliqo-detail part="detail" .record=${this.detailRecord} .fields=${this.detailFields.length ? this.detailFields : this.columns} .identity=${this.identity} .entity=${this.entity} .scope=${this.scope} .status=${current}></aeliqo-detail>` : nothing}
        `}
        ${!stale && current !== "ready" ? html`<p part="status" role="status">${this.statusText(current, this.message)}</p>` : nothing}
      </section>
    `;
  }
  private readonly forwardSelection = (raw: Event): void => { const detail = (raw as CustomEvent<AeliqoSelectionDetail>).detail; if (detail) this.dispatchEvent(event("aeliqo-search-results-selection", detail)); };
}

export class AeliqoRecordEditorElement extends AeliqoCompoundElement {
  static readonly properties = {entity: {type: String}, entityKey: {attribute: "entity-key", type: String}, entityRevision: {attribute: "entity-revision", type: String}, action: {attribute: false}, status: {type: String}, message: {type: String}, title: {type: String}, disabled: {type: Boolean}, invalid: {type: Boolean}, saveLabel: {attribute: "save-label", type: String}, cancelLabel: {attribute: "cancel-label", type: String}};
  static readonly styles = [...aeliqoCompoundThemeStyles, css`[part="form"] { display: grid; gap: var(--aeliqo-space-12, .75rem); }`];
  entity = "record"; entityKey = ""; entityRevision = ""; action: VersionRef | undefined; status: AeliqoCompoundStatus = "ready"; message = ""; title = "Edit record"; disabled = false; invalid = false; saveLabel = "Save"; cancelLabel = "Cancel";
  protected override render() {
    const current = status(this.status);
    return html`<section part="root" data-status=${current} aria-label=${this.title}>
      <div part="header"><h2>${this.title}</h2><span part="meta">${this.entity} ${this.entityKey ? `· ${this.entityKey}` : ""}${this.entityRevision ? ` · revision ${this.entityRevision}` : ""}</span></div>
      <aeliqo-form part="form" label=${this.title}>
        <slot></slot>
        <div part="actions"><button type="button" ?disabled=${this.disabled} @click=${this.cancel}>${this.cancelLabel}</button><button type="button" ?disabled=${this.disabled || this.invalid} @click=${this.save}>${this.saveLabel}</button></div>
      </aeliqo-form>
      ${this.message || current !== "ready" ? html`<p part="status" role="status">${this.statusText(current, this.message)}</p>` : nothing}
    </section>`;
  }
  private readonly save = (): void => {
    if (this.disabled || this.invalid || !this.entityKey || !this.entityRevision) return;
    const form = this.renderRoot.querySelector("aeliqo-form");
    const formValid = form instanceof AeliqoFormElement ? form.reportValidity() : true;
    const controlsValid = reportCompoundValidity(this);
    if (!formValid || !controlsValid) return;
    this.dispatchEvent(event<AeliqoRecordEditorSaveDetail>("aeliqo-record-editor-save", {
      source: "user", entity: this.entity, key: this.entityKey, entityRevision: this.entityRevision,
      values: collectCompoundValues(this), ...(this.action === undefined ? {} : {action: this.action}),
    }));
  };
  private readonly cancel = (): void => {
    if (!this.entityKey || !this.entityRevision) return;
    this.dispatchEvent(event<AeliqoRecordEditorCancelDetail>("aeliqo-record-editor-cancel", {
      source: "user", entity: this.entity, key: this.entityKey, entityRevision: this.entityRevision, values: collectCompoundValues(this),
    }));
  };
}

export class AeliqoFormFlowElement extends AeliqoCompoundElement {
  static readonly properties = {steps: {attribute: false}, activeStep: {attribute: "active-step", type: String}, draft: {attribute: false}, validation: {attribute: false}, status: {type: String}, message: {type: String}, title: {type: String}, nextLabel: {attribute: "next-label", type: String}, backLabel: {attribute: "back-label", type: String}, commitLabel: {attribute: "commit-label", type: String}};
  static readonly styles = [...aeliqoCompoundThemeStyles, css`[part="step-list"] { display: flex; flex-wrap: wrap; gap: var(--aeliqo-space-8, .5rem); list-style: none; margin: 0 0 var(--aeliqo-space-16, 1rem); padding: 0; } [part="step"][data-active="true"] { font-weight: 700; }`];
  steps: readonly AeliqoFormFlowStep[] = []; activeStep = ""; draft: Readonly<Record<string, FormDraftValue>> = {}; validation: Readonly<Record<string, string | undefined>> = {}; status: AeliqoCompoundStatus = "ready"; message = ""; title = "Form"; nextLabel = "Next"; backLabel = "Back"; commitLabel = "Commit";
  private transientDraft: FormDraftRecord = nullRecord<FormDraftValue>();
  private transientDraftSource: Readonly<Record<string, FormDraftValue>> | undefined;

  private pendingFocus: {readonly target: string; readonly trigger: Element} | undefined;
  private focusStepAfterUpdate = false;

  protected override willUpdate(changes: PropertyValues): void {
    super.willUpdate(changes);
    if (changes.has('activeStep') && this.pendingFocus !== undefined) {
      this.focusStepAfterUpdate = this.activeStep === this.pendingFocus.target && (this.shadowRoot?.activeElement ?? null) === this.pendingFocus.trigger;
      this.pendingFocus = undefined;
    }
  }

  protected override updated(changes: PropertyValues): void {
    super.updated(changes);
    if (!this.focusStepAfterUpdate) return;
    this.focusStepAfterUpdate = false;
    const first = this.controlsForStep(this.activeStep).find(control => !isDisabledControl(control) && control.getAttribute('type') !== 'hidden');
    if (first !== undefined) first.focus();
    else this.renderRoot.querySelector<HTMLElement>('[part="step-panel"]')?.focus();
  }

  protected override render() {
    const active = this.activeStep || this.steps[0]?.id || "";
    const index = this.steps.findIndex(step => step.id === active);
    const current = status(this.status);
    const error = this.validation[active];
    const named = this.hasNamedStepSlots();
    const slotName = `step-${active}`;
    return html`<section part="root" data-status=${current} aria-label=${this.title}>
      <div part="header"><h2>${this.title}</h2><span part="meta">Step ${index < 0 ? 0 : index + 1} of ${this.steps.length}</span></div>
      <ol part="step-list">${this.steps.map(step => html`<li part="step" data-active=${String(step.id === active)}><button type="button" aria-current=${step.id === active ? "step" : nothing} @click=${() => this.moveTo(step.id, this.steps.findIndex(item => item.id === step.id) > index ? "next" : "back")}>${step.label}</button></li>`)}</ol>
      ${error ? html`<p part="status" role="alert">${error}</p>` : current !== "ready" ? html`<p part="status" role="status">${this.statusText(current, this.message)}</p>` : nothing}
      <div part="step-panel" data-step=${active} tabindex="-1" role="group" aria-label=${this.steps[index]?.label ?? this.title}>${named ? html`<slot name=${slotName}></slot>` : html`<slot></slot>`}</div>
      <div part="navigation"><button type="button" ?disabled=${index <= 0} @click=${() => this.moveRelative(-1)}>${this.backLabel}</button>${index >= 0 && index < this.steps.length - 1 ? html`<button type="button" @click=${() => this.moveRelative(1)}>${this.nextLabel}</button>` : html`<button type="button" @click=${this.commit}>${this.commitLabel}</button>`}</div>
    </section>`;
  }

  private hasNamedStepSlots(): boolean {
    return Array.from(this.children ?? []).some(child => (child.getAttribute("slot") ?? "").startsWith("step-"));
  }

  private controlsForStep(stepId: string): readonly CompoundControl[] {
    if (!this.hasNamedStepSlots()) return compoundControls(this);
    return compoundControls(this).filter(control => control.closest("[slot]")?.getAttribute("slot") === `step-${stepId}`);
  }

  private stepValid(stepId: string, report = false): boolean {
    if (this.validation[stepId]) return false;
    let valid = true;
    for (const control of this.controlsForStep(stepId)) {
      if (isDisabledControl(control)) continue;
      const check = report ? (control.reportValidity ?? control.checkValidity) : control.checkValidity;
      if (check !== undefined && !check.call(control)) valid = false;
    }
    return valid;
  }

  private collectDraft(): Readonly<FormDraftRecord> {
    if (this.transientDraftSource !== this.draft) {
      this.transientDraft = nullRecord<FormDraftValue>();
      this.transientDraftSource = this.draft;
    }
    const output = Object.assign(nullRecord<FormDraftValue>(), this.draft, this.transientDraft);
    const replaced = new Set<string>();
    const replaceCurrentValue = (name: string): void => {
      if (replaced.has(name)) return;
      delete output[name];
      replaced.add(name);
    };
    for (const control of compoundControls(this)) {
      const name = control.getAttribute("name") || control.name || "";
      if (!name || isDisabledControl(control) || control instanceof HTMLButtonElement || (control instanceof HTMLInputElement && ["submit", "reset", "button", "image"].includes(control.type))) continue;
      if (control instanceof HTMLInputElement && ["checkbox", "radio"].includes(control.type)) {
        replaceCurrentValue(name);
        if (!control.checked) continue;
        appendDraftValue(output, name, control.value);
        continue;
      }
      if (control instanceof HTMLSelectElement && control.multiple) {
        replaceCurrentValue(name);
        appendDraftValue(output, name, [...control.selectedOptions].map(option => option.value));
        continue;
      }
      const range = dateRangeParts(control, name);
      if (range !== undefined) {
        replaceCurrentValue(range[0]);
        replaceCurrentValue(`${name}[end]`);
        appendDraftValue(output, range[0], range[1]);
        const end = (control as HTMLElement & {readonly end?: string}).end;
        if (typeof end === "string") appendDraftValue(output, `${name}[end]`, end);
      } else {
        replaceCurrentValue(name);
        appendDraftValue(output, name, "formValue" in control ? control.formValue : control.value);
      }
    }
    return output;
  }

  private captureDraft(): Readonly<FormDraftRecord> {
    this.transientDraft = Object.assign(nullRecord<FormDraftValue>(), this.collectDraft());
    this.transientDraftSource = this.draft;
    return this.transientDraft;
  }

  private moveRelative(delta: number): void {
    const active = this.activeStep || this.steps[0]?.id || "";
    const index = this.steps.findIndex(step => step.id === active);
    const target = this.steps[index + delta];
    if (target) this.moveTo(target.id, delta > 0 ? "next" : "back");
  }

  private moveTo(target: string, direction: "next" | "back"): void {
    const from = this.activeStep || this.steps[0]?.id || "";
    const fromIndex = this.steps.findIndex(step => step.id === from);
    const targetIndex = this.steps.findIndex(step => step.id === target);
    if (!target || target === from || fromIndex < 0 || targetIndex < 0) return;
    if (direction === "next") {
      for (let index = fromIndex; index < targetIndex; index += 1) if (!this.stepValid(this.steps[index]!.id, true)) return;
    }
    const trigger = (this.shadowRoot?.activeElement ?? null);
    this.pendingFocus = trigger === null ? undefined : {target, trigger};
    const change = event<AeliqoFormFlowStepDetail>("aeliqo-form-flow-step", {source: "user", from, to: target, direction, draft: this.captureDraft()});
    this.dispatchEvent(change);
    if (change.defaultPrevented) this.pendingFocus = undefined;
  }

  private readonly commit = (): void => {
    const active = this.activeStep || this.steps[0]?.id || "";
    if (!active) return;
    for (const step of this.steps) if (!this.stepValid(step.id, true)) return;
    this.dispatchEvent(event<AeliqoFormFlowCommitDetail>("aeliqo-form-flow-commit", {source: "user", step: active, draft: this.captureDraft()}));
  };
}

export class AeliqoQualityPanelElement extends AeliqoCompoundElement {
  static readonly properties = {source: {type: String}, freshness: {type: String}, completeness: {type: String}, provenance: {attribute: false}, unsupportedClaims: {attribute: false}, status: {type: String}, message: {type: String}, title: {type: String}, state: {attribute: false}};
  static readonly styles = [...aeliqoCompoundThemeStyles, css`dl { display: grid; gap: var(--aeliqo-space-8, .5rem) var(--aeliqo-space-16, 1rem); grid-template-columns: minmax(8rem, max-content) minmax(0, 1fr); margin: 0; } dt { color: var(--aeliqo-color-muted, #475569); overflow-wrap: anywhere; } dd { margin: 0; min-inline-size: 0; overflow-wrap: anywhere; } bdi { overflow-wrap: anywhere; } ul { margin-block: var(--aeliqo-space-8, .5rem) 0; padding-inline-start: 1.25rem; } @media (max-width: 30rem) { dl { grid-template-columns: minmax(0, 1fr); } dd:not(:last-child) { margin-block-end: var(--aeliqo-space-12, .75rem); } }`];
  source = ""; freshness = ""; completeness = ""; provenance: readonly string[] = []; unsupportedClaims: readonly string[] = []; status: AeliqoCompoundStatus = "ready"; message = ""; title = "Data quality"; state: AeliqoQualityState | undefined;
  protected override render() { const source = this.state?.source ?? this.source; const freshness = this.state?.freshness ?? this.freshness; const completeness = this.state?.completeness ?? this.completeness; const provenance = this.state?.provenance ?? this.provenance; const unsupported = this.state?.unsupportedClaims ?? this.unsupportedClaims; const current = status(this.status); return html`<section part="root" data-status=${current} aria-label=${this.title}><div part="header"><h2>${this.title}</h2><span part="meta">${current === "ready" ? "Reported metadata" : this.statusText(current, this.message)}</span></div><dl><dt>Source</dt><dd><bdi>${source || "Not supplied"}</bdi></dd><dt>Freshness</dt><dd><bdi>${freshness || "Not supplied"}</bdi></dd><dt>Completeness</dt><dd><bdi>${completeness || "Not supplied"}</bdi></dd><dt>Provenance</dt><dd>${provenance.length ? html`<ul>${provenance.map(item => html`<li><bdi>${item}</bdi></li>`)}</ul>` : html`<bdi>Not supplied</bdi>`}</dd></dl>${current !== "ready" ? html`<p part="status" role="status">${this.statusText(current, this.message)}</p>` : nothing}${unsupported.length ? html`<p part="caution"><bdi>Unsupported claims are shown explicitly and are not presented as facts.</bdi></p><ul part="unsupported">${unsupported.map(item => html`<li><bdi>${item}</bdi></li>`)}</ul>` : nothing}</section>`; }
}
