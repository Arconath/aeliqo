import {css, html, LitElement, nothing} from "lit";
import {aeliqoThemeStyles} from "../styles/theme.js";
import {validateScalar} from "@aeliqo/sdk-core";
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

type AeliqoFilterLogical = "and" | "or";

const MAX_PREDICATE_DEPTH = 32;
const MAX_PREDICATE_NODES = 128;
// A manual compound predicate consumes one node for its logical parent.
const MAX_MANUAL_CLAUSES = MAX_PREDICATE_NODES - 1;

interface PredicateTraversal {
  nodes: number;
}

interface PredicateProjection {
  readonly clauses: readonly AeliqoFilterClause[];
  readonly logical: AeliqoFilterLogical;
  readonly unsupported?: AeliqoFilterPredicate;
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
  const semanticType = fieldSemanticType(field);
  if (semanticType === undefined) return undefined;
  const value = semanticType.value === "text" ? raw : raw.trim();
  if (semanticType.value !== "text" && value.length === 0) return undefined;
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

type MembershipJsonValue = string | boolean | number | null;

function membershipJsonValue(value: AeliqoFilterValue): MembershipJsonValue | undefined {
  if (value === null || typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number") return Number.isFinite(value) ? value : undefined;
  if (typeof value !== "object" || Array.isArray(value)) return undefined;
  const checked = validateScalar(value, {value: "decimal", nullable: false});
  if (!checked.ok || checked.value === null || typeof checked.value !== "object" || Array.isArray(checked.value)) return undefined;
  return typeof checked.value.decimal === "string" ? checked.value.decimal : undefined;
}

function membershipJsonText(values: readonly AeliqoFilterValue[]): string | undefined {
  const serialized = values.map((value) => membershipJsonValue(value));
  if (serialized.some((value) => value === undefined)) return undefined;
  return JSON.stringify(serialized);
}

function predicateEntityMatches(predicate: AeliqoFilterPredicate, entity: string): boolean {
  const candidate = (predicate as AeliqoFilterPredicate & {readonly entity?: unknown}).entity;
  return candidate === undefined || candidate === entity;
}

function clauseFromPredicate(predicate: AeliqoFilterPredicate | undefined, entity: string): AeliqoFilterClause | undefined {
  if (predicate?.op === "compare") {
    if (predicate.value === null || predicate.value === undefined) return undefined;
    if (!predicateEntityMatches(predicate, entity)) return undefined;
    return {field: predicate.field, operator: predicate.comparison, value: dataValueText(predicate.value, "")};
  }
  if (predicate?.op === "is-null") {
    if (!predicateEntityMatches(predicate, entity)) return undefined;
    return {field: predicate.field, operator: predicate.negate ? "not-null" : "is-null"};
  }
  if (predicate?.op === "in") {
    if (!predicateEntityMatches(predicate, entity)) return undefined;
    const value = Array.isArray(predicate.values) ? membershipJsonText(predicate.values) : undefined;
    return value === undefined ? undefined : {field: predicate.field, operator: "in", value};
  }
  if (predicate?.op === "not" && predicate.predicate.op === "is-null") {
    if (!predicateEntityMatches(predicate, entity) || !predicateEntityMatches(predicate.predicate, entity)) return undefined;
    return {field: predicate.predicate.field, operator: predicate.predicate.negate ? "is-null" : "not-null"};
  }
  return undefined;
}

function unsupportedProjection(predicate: AeliqoFilterPredicate, logical: AeliqoFilterLogical = "and"): PredicateProjection {
  return {clauses: [], logical, unsupported: predicate};
}

function projectPredicate(
  predicate: AeliqoFilterPredicate | undefined,
  depth = 0,
  traversal: PredicateTraversal = {nodes: 0},
  entity = "",
): PredicateProjection {
  try {
    if (predicate === undefined) return {clauses: [], logical: "and"};
    if (depth > MAX_PREDICATE_DEPTH || traversal.nodes >= MAX_PREDICATE_NODES) return unsupportedProjection(predicate);
    traversal.nodes += 1;
    if (!predicateEntityMatches(predicate, entity)) return unsupportedProjection(predicate);
    const clause = clauseFromPredicate(predicate, entity);
    if (clause !== undefined) return {clauses: [clause], logical: "and"};
    if (predicate.op !== "and" && predicate.op !== "or") return {clauses: [], logical: "and", unsupported: predicate};
    const predicates = predicate.predicates;
    if (!Array.isArray(predicates) || predicates.length === 0) return unsupportedProjection(predicate, predicate.op);
    const clauses: AeliqoFilterClause[] = [];
    for (let index = 0; index < predicates.length; index += 1) {
      if (traversal.nodes >= MAX_PREDICATE_NODES) return unsupportedProjection(predicate, predicate.op);
      const child = predicates[index];
      if (child === undefined) return unsupportedProjection(predicate, predicate.op);
      const projection = projectPredicate(child, depth + 1, traversal, entity);
      if (projection.unsupported !== undefined || (projection.clauses.length > 1 && projection.logical !== predicate.op)) {
        return unsupportedProjection(predicate, predicate.op);
      }
      clauses.push(...projection.clauses);
    }
    return clauses.length === 0
      ? unsupportedProjection(predicate, predicate.op)
      : {clauses, logical: predicate.op};
  } catch {
    return predicate === undefined
      ? {clauses: [], logical: "and"}
      : unsupportedProjection(predicate);
  }
}

function predicateText(
  predicate: AeliqoFilterPredicate,
  depth = 0,
  traversal: PredicateTraversal = {nodes: 0},
  parentLogical = false,
): string {
  try {
    if (depth > MAX_PREDICATE_DEPTH || traversal.nodes >= MAX_PREDICATE_NODES) return "Unsupported filter condition";
    traversal.nodes += 1;
    if (predicate.op === "compare") {
      if (predicate.value === null || predicate.value === undefined) return "Unsupported filter condition";
      return `${predicate.field} ${predicate.comparison} ${dataValueText(predicate.value, "")}`;
    }
    if (predicate.op === "is-null") return `${predicate.field} ${predicate.negate ? "is not empty" : "is empty"}`;
    if (predicate.op === "in") {
      const value = Array.isArray(predicate.values) ? membershipJsonText(predicate.values) : undefined;
      return value === undefined ? "Unsupported filter condition" : `${predicate.field} is one of ${value}`;
    }
    if (predicate.op === "not") return `NOT (${predicateText(predicate.predicate, depth + 1, traversal)})`;
    if (predicate.op !== "and" && predicate.op !== "or") return "Unsupported filter condition";
    const predicates = predicate.predicates;
    if (!Array.isArray(predicates) || predicates.length === 0) return "Unsupported filter condition";
    const joiner = predicate.op === "and" ? " AND " : " OR ";
    const children: string[] = [];
    for (let index = 0; index < predicates.length; index += 1) {
      if (traversal.nodes >= MAX_PREDICATE_NODES) return "Unsupported filter condition";
      const child = predicates[index];
      if (child === undefined) return "Unsupported filter condition";
      children.push(predicateText(child, depth + 1, traversal, true));
    }
    const text = children.join(joiner);
    return parentLogical ? `(${text})` : text;
  } catch {
    return "Unsupported filter condition";
  }
}

function predicateSourceSignature(predicate: AeliqoFilterPredicate, projection: PredicateProjection, entity: string): string {
  if (projection.unsupported !== undefined) return `unsupported:${predicateText(predicate)}`;
  const logical = projection.clauses.length > 1 ? projection.logical : "and";
  return JSON.stringify({entity, logical, clauses: projection.clauses});
}

function clausesSourceSignature(clauses: readonly AeliqoFilterClause[], logical: AeliqoFilterLogical): string {
  return JSON.stringify({logical: clauses.length > 1 ? logical : "and", clauses});
}

function parseMembershipValue(raw: unknown, field: AeliqoFieldOption | undefined): AeliqoFilterValue | undefined {
  const semanticType = fieldSemanticType(field);
  if (semanticType === undefined) return undefined;
  if (typeof raw === "string") return parseValue(raw, field);
  if (raw === null || typeof raw === "boolean" || typeof raw === "number") {
    const checked = validateScalar(raw, semanticType);
    return checked.ok ? checked.value : undefined;
  }
  if (semanticType.value !== "decimal" || typeof raw !== "object" || Array.isArray(raw)) return undefined;
  const checked = validateScalar(raw, semanticType);
  return checked.ok ? checked.value : undefined;
}

function parseMembershipValues(raw: string, field: AeliqoFieldOption | undefined): AeliqoFilterValue[] | undefined {
  const source = raw.trim();
  if (source.length === 0) return undefined;
  let rawValues: readonly unknown[];
  if (source.startsWith("[")) {
    try {
      const parsed: unknown = JSON.parse(source);
      if (!Array.isArray(parsed)) return undefined;
      rawValues = parsed;
    } catch {
      return undefined;
    }
  } else {
    rawValues = source.split(",");
  }
  const values = rawValues.map((value) => parseMembershipValue(value, field));
  return values.some((value) => value === undefined) ? undefined : values as AeliqoFilterValue[];
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
    const values = parseMembershipValues(clause.value ?? "", field);
    if (values === undefined) return undefined;
    return {op: "in", field: clause.field, ...base, values};
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

  static readonly aeliqoVersion = "0.1.0";

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

  private clauseDrafts: AeliqoFilterClause[] = [];
  private logicalMode: AeliqoFilterLogical = "and";
  private unsupportedPredicate: AeliqoFilterPredicate | undefined = undefined;
  private draftSourceSignature: string | undefined;
  private draftInitialized = false;
  private draftInteracted = false;
  private validationMessage = "";

  protected override willUpdate(changed: Map<string, unknown>): void {
    if (changed.has("predicate") || changed.has("clauses") || changed.has("logical") || changed.has("entity") || changed.has("fields") || !this.draftInitialized) {
      const projection: PredicateProjection = this.predicate !== undefined
        ? projectPredicate(this.predicate, 0, {nodes: 0}, this.entity)
        : {clauses: this.clauses.map((clause) => ({...clause})), logical: this.logical === "or" ? "or" : "and"};
      const signature = this.predicate !== undefined
        ? predicateSourceSignature(this.predicate, projection, this.entity)
        : clausesSourceSignature(projection.clauses, projection.logical);
      this.unsupportedPredicate = projection.unsupported;
      if (!this.draftInitialized || signature !== this.draftSourceSignature) {
        this.clauseDrafts = projection.clauses.map((clause) => ({...clause}));
        this.logicalMode = projection.logical;
        this.draftInteracted = false;
      }
      // A compound can provide its fields after the first child update. Seed a
      // usable draft once the options arrive, while preserving a draft that
      // the author has already edited or composed manually.
      if (this.clauseDrafts.length === 0 && this.fields.length > 0 && this.unsupportedPredicate === undefined && !this.draftInteracted) {
        this.clauseDrafts = [{field: this.fields[0]!.id, operator: "eq", value: ""}];
      }
      this.draftSourceSignature = signature;
      this.draftInitialized = true;
    }
  }

  protected override render() {
    const disabled = this.status === "loading" || this.status === "error" || this.status === "unavailable";
    const applyDisabled = disabled || this.unsupportedPredicate !== undefined;
    return html`
      <form part="builder" @submit=${this.handleSubmit}>
        <fieldset ?disabled=${disabled}>
          <legend>Filter</legend>
          <div part="scope" aria-label="Inherited scope">${this.scopeLabel}</div>
          <div part="clauses">
            ${this.clauseDrafts.map((clause, index) => this.renderClause(clause, index))}
            ${this.clauseDrafts.length > 1 ? html`<label part="logical-label">Match
              <select part="logical" .value=${this.logicalMode} @change=${this.handleLogicalChange}>
                <option value="and">All conditions</option><option value="or">Any condition</option>
              </select>
            </label>` : nothing}
          </div>
          ${this.unsupportedPredicate === undefined ? html`<button part="add-condition" type="button" ?disabled=${disabled || this.fields.length === 0 || this.clauseDrafts.length >= MAX_MANUAL_CLAUSES} @click=${this.handleAddCondition}>Add condition</button>` : nothing}
          ${this.unsupportedPredicate === undefined ? nothing : html`<div part="unsupported-predicate" role="status">This filter contains a nested condition that is read-only: ${predicateText(this.unsupportedPredicate)}</div>`}
          ${this.inherited === undefined ? nothing : html`<div part="inherited-predicate" role="status">Inherited filter (read-only): ${predicateText(this.inherited)}</div>`}
          <button part="apply" type="submit" ?disabled=${applyDisabled}>${this.applyLabel}</button>
          ${this.validationMessage ? html`<p part="validation" role="alert">${this.validationMessage}</p>` : nothing}
        </fieldset>
      </form>
      ${this.status === "partial" || this.status === "stale" ? statusTemplate(this.status, this.message) : nothing}
    `;
  }

  private renderClause(clause: AeliqoFilterClause, index: number) {
    return html`<div part="clause" data-clause-index=${index}>
      <label part="field-label">Field ${index + 1}
        <select part="field" data-clause-index=${index} @change=${this.handleFieldChange}>
          <option value="" ?selected=${clause.field.length === 0}>Choose a field</option>
          ${this.fields.map((field) => html`<option value=${field.id} ?selected=${field.id === clause.field}>${field.label}</option>`)}
        </select>
      </label>
      <label part="operator-label">Condition ${index + 1}
        <select part="operator" data-clause-index=${index} .value=${clause.operator} @change=${this.handleOperatorChange}>
          <option value="eq">Equals</option><option value="ne">Does not equal</option>
          <option value="lt">Less than</option><option value="lte">Less than or equal</option>
          <option value="gt">Greater than</option><option value="gte">Greater than or equal</option>
          <option value="in">Is one of</option><option value="is-null">Is empty</option><option value="not-null">Is not empty</option>
        </select>
      </label>
      ${this.clauseNeedsValue(clause) ? html`<label part="value-label">${clause.operator === "in" ? "Values (JSON array)" : "Value"} ${index + 1}
        <input part="value" data-clause-index=${index} .value=${clause.value ?? ""} @input=${this.handleValueInput} @compositionend=${this.handleValueInput} />
      </label>` : nothing}
      <button part="remove-condition" type="button" data-clause-index=${index} aria-label=${`Remove condition ${index + 1}`} ?disabled=${this.status === "loading" || this.status === "error" || this.status === "unavailable" || this.clauseDrafts.length <= 1 || this.unsupportedPredicate !== undefined} @click=${this.handleRemoveCondition}>Remove</button>
    </div>`;
  }

  private clauseNeedsValue(clause: AeliqoFilterClause): boolean {
    return clause.operator !== "is-null" && clause.operator !== "not-null";
  }

  private clauseIndex(event: Event): number | undefined {
    const target = event.currentTarget;
    if (!(target instanceof HTMLElement)) return undefined;
    const index = Number(target.dataset.clauseIndex);
    return Number.isSafeInteger(index) && index >= 0 && index < this.clauseDrafts.length ? index : undefined;
  }

  private updateClause(index: number, update: Partial<AeliqoFilterClause>): void {
    const clause = this.clauseDrafts[index];
    if (clause === undefined) return;
    this.clauseDrafts = this.clauseDrafts.map((candidate, position) => position === index ? {...candidate, ...update} : candidate);
    this.draftInteracted = true;
    this.validationMessage = "";
    this.requestUpdate();
  }

  private readonly handleAddCondition = (): void => {
    if (this.fields.length === 0 || this.unsupportedPredicate !== undefined || this.status === "loading" || this.status === "error" || this.status === "unavailable" || this.clauseDrafts.length >= MAX_MANUAL_CLAUSES) return;
    this.clauseDrafts = [...this.clauseDrafts, {field: this.fields[0]!.id, operator: "eq", value: ""}];
    this.draftInteracted = true;
    this.validationMessage = "";
    this.requestUpdate();
  };

  private readonly handleRemoveCondition = (event: Event): void => {
    const index = this.clauseIndex(event);
    if (index === undefined || this.clauseDrafts.length <= 1 || this.unsupportedPredicate !== undefined || this.status === "loading" || this.status === "error" || this.status === "unavailable") return;
    this.clauseDrafts = this.clauseDrafts.filter((_, position) => position !== index);
    const focusIndex = Math.min(index, this.clauseDrafts.length - 1);
    this.draftInteracted = true;
    this.validationMessage = "";
    this.requestUpdate();
    void this.updateComplete.then(() => {
      const field = [...this.renderRoot.querySelectorAll<HTMLSelectElement>('select[part="field"]')]
        .find((candidate) => Number(candidate.dataset.clauseIndex) === focusIndex);
      (field ?? this.renderRoot.querySelector<HTMLButtonElement>('button[part="add-condition"]'))?.focus();
    });
    if (this.autoApply) this.apply();
  };

  private readonly handleFieldChange = (event: Event): void => {
    const target = event.currentTarget;
    const index = this.clauseIndex(event);
    if (!(target instanceof HTMLSelectElement) || index === undefined) return;
    this.updateClause(index, {field: target.value});
    if (this.autoApply) this.apply();
  };

  private readonly handleOperatorChange = (event: Event): void => {
    const target = event.currentTarget;
    const index = this.clauseIndex(event);
    if (!(target instanceof HTMLSelectElement) || index === undefined) return;
    const operator = target.value as AeliqoFilterOperator;
    this.updateClause(index, {operator});
    if (this.autoApply) this.apply();
  };

  private readonly handleValueInput = (event: Event): void => {
    const target = event.currentTarget;
    const index = this.clauseIndex(event);
    if (!(target instanceof HTMLInputElement) || index === undefined) return;
    this.updateClause(index, {value: target.value});
    // Deliberately no event/query here; only Apply commits the predicate.
  };

  private readonly handleLogicalChange = (event: Event): void => {
    const target = event.currentTarget;
    if (!(target instanceof HTMLSelectElement)) return;
    this.logicalMode = target.value === "or" ? "or" : "and";
    this.validationMessage = "";
    this.requestUpdate();
  };

  private readonly handleSubmit = (event: Event): void => {
    event.preventDefault();
    this.apply();
  };

  private readonly apply = (): void => {
    if (this.unsupportedPredicate !== undefined) return;
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
    const predicates = this.clauseDrafts.map((clause) => buildAeliqoPredicate(clause, this.fields.find((field) => field.id === clause.field), this.entity));
    if (predicates.some((predicate) => predicate === undefined)) return undefined;
    const valid = predicates as AeliqoFilterPredicate[];
    if (valid.length === 1) return valid[0];
    return {op: this.logicalMode, predicates: valid};
  }

  static readonly styles = [aeliqoThemeStyles, dataStyles, css`
    :host { min-inline-size: 0; }
    form { max-inline-size: 100%; }
    fieldset { border: 0; display: flex; flex-wrap: wrap; gap: var(--aeliqo-space-8, 0.5rem); margin: 0; min-inline-size: 0; padding: 0; }
    legend { font-weight: var(--aeliqo-typography-font-weight-semibold, 600); padding: 0; }
    [part="clauses"] { display: grid; flex-basis: 100%; gap: var(--aeliqo-space-8, 0.5rem); }
    [part="clause"] { align-items: end; display: flex; flex-wrap: wrap; gap: var(--aeliqo-space-8, 0.5rem); }
    label { display: grid; gap: var(--aeliqo-space-4, 0.25rem); max-inline-size: 100%; min-inline-size: min(100%, 9rem); }
    [part="scope"] { color: var(--aeliqo-color-muted, #475569); flex-basis: 100%; font-size: var(--aeliqo-typography-font-size-caption, 0.8125rem); }
    [part="unsupported-predicate"], [part="inherited-predicate"] { background: var(--aeliqo-color-surface-muted, #f1f5f9); border-inline-start: 0.1875rem solid var(--aeliqo-color-warning, #b45309); flex-basis: 100%; padding: var(--aeliqo-space-8, 0.5rem); }
    select, input, [part="add-condition"], [part="remove-condition"], [part="apply"] { background: var(--aeliqo-color-surface, #fff); border: var(--aeliqo-control-border-width, 0.0625rem) solid var(--aeliqo-color-border, #94a3b8); border-radius: var(--aeliqo-radius-small, 0.375rem); color: inherit; font: inherit; min-block-size: var(--aeliqo-control-min-target, 2.75rem); padding-inline: var(--aeliqo-space-8, 0.5rem); }
    select, input { inline-size: 100%; min-inline-size: 0; }
    [part="add-condition"], [part="remove-condition"] { cursor: pointer; }
    [part="apply"] { align-self: end; background: var(--aeliqo-color-accent, #4338ca); border-color: var(--aeliqo-color-accent, #4338ca); color: var(--aeliqo-color-on-accent, #fff); cursor: pointer; }
    [part="validation"] { color: var(--aeliqo-color-danger, #b91c1c); flex-basis: 100%; margin: 0; }
    @media (forced-colors: active) { select, input, [part="add-condition"], [part="remove-condition"], [part="apply"] { background: Canvas; border-color: ButtonText; color: CanvasText; } [part="apply"] { background: Highlight; color: HighlightText; } }
  `];
}
