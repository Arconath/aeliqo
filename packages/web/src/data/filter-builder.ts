import {css, html, LitElement, nothing} from "lit";
import {aeliqoThemeStyles} from "../styles/theme.js";
import {validateScalar} from "@aeliqo/core";
import type {AeliqoDataStatus, AeliqoFieldOption, AeliqoFilterPredicate, AeliqoFilterValue} from "./types.js";
import {AeliqoFilterChangeEvent} from "./events.js";
import {dataStyles, dataValueText, statusTemplate} from "./shared.js";

export type AeliqoFilterOperator = "eq" | "ne" | "lt" | "lte" | "gt" | "gte" | "is-null" | "not-null" | "in";

export interface AeliqoFilterClause {
  readonly field: string;
  readonly operator: AeliqoFilterOperator;
  readonly value?: string;
}

export function combineAeliqoPredicates(
  predicate: AeliqoFilterPredicate | undefined,
  inherited: AeliqoFilterPredicate | undefined,
): AeliqoFilterPredicate | undefined {
  if (predicate === undefined) return inherited;
  if (inherited === undefined) return predicate;
  return {op: "and", predicates: [inherited, predicate]};
}

export function validateAeliqoPredicate(predicate: AeliqoFilterPredicate | undefined): {readonly ok: true} | {readonly ok: false; readonly message: string} {
  if (predicate === undefined) return {ok: false, message: "Choose a field and value before applying the filter."};
  if (predicate.op === "and" || predicate.op === "or") {
    return predicate.predicates.length === 0 ? {ok: false, message: "Add at least one filter condition."} : {ok: true};
  }
  if (predicate.op === "not") return validateAeliqoPredicate(predicate.predicate);
  if (predicate.op === "in" && predicate.values.length === 0) return {ok: false, message: "Provide at least one value."};
  return {ok: true};
}

function fieldSemanticType(field: AeliqoFieldOption | undefined) {
  if (field?.semanticType !== undefined) return field.semanticType;
  if (field?.type === undefined) return undefined;
  return {value: field.type, nullable: field.nullable ?? true} as const;
}

function parseValue(raw: string, field: AeliqoFieldOption | undefined): AeliqoFilterValue | undefined {
  const value = raw.trim();
  if (value.length === 0) return undefined;
  const semanticType = fieldSemanticType(field);
  if (semanticType === undefined) return undefined;
  let candidate: unknown = value;
  if (semanticType.value === "boolean") {
    if (value.toLowerCase() === "true") return true;
    if (value.toLowerCase() === "false") return false;
    return undefined;
  }
  if (semanticType.value === "integer") {
    const parsed = Number(value);
    candidate = Number.isSafeInteger(parsed) ? parsed : undefined;
  }
  if (semanticType.value === "float") {
    const parsed = Number(value);
    candidate = Number.isFinite(parsed) ? parsed : undefined;
  }
  if (semanticType.value === "decimal") {
    candidate = {decimal: value};
  }
  if (candidate === undefined) return undefined;
  const checked = validateScalar(candidate, semanticType);
  return checked.ok ? checked.value : undefined;
}

function clauseFromPredicate(predicate: AeliqoFilterPredicate | undefined): AeliqoFilterClause {
  if (predicate?.op === "compare") return {field: predicate.field, operator: predicate.comparison, value: dataValueText(predicate.value, "")};
  if (predicate?.op === "is-null") return {field: predicate.field, operator: predicate.negate ? "not-null" : "is-null"};
  if (predicate?.op === "in") return {field: predicate.field, operator: "in", value: predicate.values.map((value) => dataValueText(value, "")).join(", ")};
  return {field: "", operator: "eq", value: ""};
}

/** Convert one author-controlled draft clause into the canonical predicate
 * vocabulary. Invalid values return undefined rather than being coerced. */
export function buildAeliqoPredicate(
  clause: AeliqoFilterClause,
  field: AeliqoFieldOption | undefined,
  entity = "",
): AeliqoFilterPredicate | undefined {
  if (clause.field.length === 0 || field === undefined || field.id !== clause.field) return undefined;
  const base = entity.length === 0 ? {} : {entity};
  if (clause.operator === "is-null" || clause.operator === "not-null") return {op: "is-null", field: clause.field, ...base, negate: clause.operator === "not-null"};
  if (clause.operator === "in") {
    const rawValues = (clause.value ?? "").split(",");
    const values = rawValues.map((value) => parseValue(value, field));
    if (values.some((value) => value === undefined)) return undefined;
    return {op: "in", field: clause.field, ...base, values: values as AeliqoFilterValue[]};
  }
  const value = parseValue(clause.value ?? "", field);
  if (value === undefined) return undefined;
  return {op: "compare", field: clause.field, ...base, comparison: clause.operator, value};
}

/** Builds a typed predicate locally and only emits it on an explicit Apply.
 * Typing, composition and IME input never execute a query. */
export class AeliqoFilterBuilderElement extends LitElement {
  static readonly properties = {
    fields: {attribute: false},
    predicate: {attribute: false},
    inherited: {attribute: false},
    entity: {type: String},
    scopeLabel: {attribute: "scope-label", type: String},
    applyLabel: {attribute: "apply-label", type: String},
    autoApply: {attribute: "auto-apply", type: Boolean},
    clauses: {attribute: false},
    logical: {type: String},
    status: {type: String},
    message: {type: String},
  };

  static readonly aeliqoVersion = "0.1.0-m0";

  fields: readonly AeliqoFieldOption[] = [];
  predicate: AeliqoFilterPredicate | undefined = undefined;
  inherited: AeliqoFilterPredicate | undefined = undefined;
  entity = "";
  scopeLabel = "Current authorized scope";
  applyLabel = "Apply filter";
  autoApply = false;
  clauses: readonly AeliqoFilterClause[] = [];
  logical: "and" | "or" = "and";
  status: AeliqoDataStatus = "ready";
  message = "";

  private draft: AeliqoFilterClause = {field: "", operator: "eq", value: ""};
  private draftInitialized = false;
  private validationMessage = "";

  protected override willUpdate(changed: Map<string, unknown>): void {
    if (changed.has("predicate") || changed.has("clauses") || !this.draftInitialized) {
      this.draft = this.clauses[0] ?? clauseFromPredicate(this.predicate);
      if (this.draft.field.length === 0 && this.fields[0] !== undefined) this.draft = {...this.draft, field: this.fields[0].id};
      this.draftInitialized = true;
    }
  }

  protected override render() {
    const disabled = this.status === "loading" || this.status === "error" || this.status === "unavailable";
    return html`
      <form part="builder" @submit=${this.handleSubmit}>
        <fieldset ?disabled=${disabled}>
          <legend>Filter</legend>
          <div part="scope" aria-label="Inherited scope">${this.scopeLabel}</div>
          <label part="field-label">Field
              <select part="field" @change=${this.handleFieldChange}>
              <option value="" ?selected=${this.draft.field.length === 0}>Choose a field</option>
              ${this.fields.map((field) => html`<option value=${field.id} ?selected=${this.draft.field === field.id}>${field.label}</option>`)}
            </select>
          </label>
          <label part="operator-label">Condition
            <select part="operator" .value=${this.draft.operator} @change=${this.handleOperatorChange}>
              <option value="eq">Equals</option><option value="ne">Does not equal</option>
              <option value="lt">Less than</option><option value="lte">Less than or equal</option>
              <option value="gt">Greater than</option><option value="gte">Greater than or equal</option>
              <option value="in">Is one of</option><option value="is-null">Is empty</option><option value="not-null">Is not empty</option>
            </select>
          </label>
          ${this.needsValue ? html`<label part="value-label">Value
            <input part="value" .value=${this.draft.value ?? ""} @input=${this.handleValueInput} @compositionend=${this.handleValueInput} />
          </label>` : nothing}
          <button part="apply" type="submit">${this.applyLabel}</button>
          ${this.validationMessage ? html`<p part="validation" role="alert">${this.validationMessage}</p>` : nothing}
        </fieldset>
      </form>
      ${this.status === "partial" || this.status === "stale" ? statusTemplate(this.status, this.message) : nothing}
    `;
  }

  private get selectedField(): AeliqoFieldOption | undefined {
    return this.fields.find((field) => field.id === this.draft.field);
  }

  private get needsValue(): boolean {
    return this.draft.operator !== "is-null" && this.draft.operator !== "not-null";
  }

  private readonly handleFieldChange = (event: Event): void => {
    const target = event.target;
    if (!(target instanceof HTMLSelectElement)) return;
    this.draft = {...this.draft, field: target.value};
    this.validationMessage = "";
    if (this.autoApply) this.apply();
  };

  private readonly handleOperatorChange = (event: Event): void => {
    const target = event.target;
    if (!(target instanceof HTMLSelectElement)) return;
    const operator = target.value as AeliqoFilterOperator;
    this.draft = {...this.draft, operator};
    this.validationMessage = "";
    if (this.autoApply) this.apply();
  };

  private readonly handleValueInput = (event: Event): void => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) return;
    this.draft = {...this.draft, value: target.value};
    this.validationMessage = "";
    // Deliberately no event/query here; only Apply commits the predicate.
  };

  private readonly handleSubmit = (event: Event): void => {
    event.preventDefault();
    this.apply();
  };

  private readonly apply = (): void => {
    const local = this.buildPredicate();
    const checked = validateAeliqoPredicate(local);
    if (!checked.ok || local === undefined) {
      this.validationMessage = checked.ok ? "Choose a valid filter." : checked.message;
      this.requestUpdate();
      return;
    }
    this.validationMessage = "";
    const predicate = combineAeliqoPredicates(local, this.inherited);
    this.dispatchEvent(new AeliqoFilterChangeEvent({
      ...(predicate === undefined ? {} : {predicate}),
      ...(this.inherited === undefined ? {} : {inherited: this.inherited}),
      scopeLabel: this.scopeLabel,
      applied: true,
    }));
  };

  private buildPredicate(): AeliqoFilterPredicate | undefined {
    const clauses = [this.draft, ...this.clauses.slice(1)];
    const predicates = clauses.map((clause) => buildAeliqoPredicate(clause, this.fields.find((field) => field.id === clause.field), this.entity));
    if (predicates.some((predicate) => predicate === undefined)) return undefined;
    const valid = predicates as AeliqoFilterPredicate[];
    if (valid.length === 1) return valid[0];
    return {op: this.logical === "or" ? "or" : "and", predicates: valid};
  }

  static readonly styles = [aeliqoThemeStyles, dataStyles, css`
    form { max-inline-size: 100%; }
    fieldset { border: 0; display: flex; flex-wrap: wrap; gap: var(--aeliqo-space-8, 0.5rem); margin: 0; min-inline-size: 0; padding: 0; }
    legend { font-weight: var(--aeliqo-typography-font-weight-semibold, 600); padding: 0; }
    label { display: grid; gap: var(--aeliqo-space-4, 0.25rem); min-inline-size: 9rem; }
    [part="scope"] { color: var(--aeliqo-color-muted, #475569); flex-basis: 100%; font-size: var(--aeliqo-typography-font-size-caption, 0.8125rem); }
    select, input, [part="apply"] { background: var(--aeliqo-color-surface, #fff); border: var(--aeliqo-control-border-width, 0.0625rem) solid var(--aeliqo-color-border, #94a3b8); border-radius: var(--aeliqo-radius-small, 0.375rem); color: inherit; font: inherit; min-block-size: var(--aeliqo-control-min-target, 2.75rem); padding-inline: var(--aeliqo-space-8, 0.5rem); }
    [part="apply"] { align-self: end; background: var(--aeliqo-color-accent, #4338ca); border-color: var(--aeliqo-color-accent, #4338ca); color: var(--aeliqo-color-on-accent, #fff); cursor: pointer; }
    [part="validation"] { color: var(--aeliqo-color-danger, #b91c1c); flex-basis: 100%; margin: 0; }
    @media (forced-colors: active) { select, input, [part="apply"] { background: Canvas; border-color: ButtonText; color: CanvasText; } [part="apply"] { background: Highlight; color: HighlightText; } }
  `];
}
