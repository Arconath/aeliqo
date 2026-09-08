import {css, html, nothing} from "lit";
import type {TemplateResult} from "lit";
import {AeliqoFoundationElement, aeliqoFoundationThemeStyles} from "../foundation/base.js";
import {AeliqoValidationEvent, type AeliqoValidationState} from "./events.js";

export type AeliqoValidationResult =
  | boolean
  | string
  | {readonly valid: boolean; readonly message?: string}
  | void;

export type AeliqoValidator<T> = (
  value: T,
  signal: AbortSignal,
) => AeliqoValidationResult | Promise<AeliqoValidationResult>;

export const aeliqoInputStyles = [...aeliqoFoundationThemeStyles, css`
  :host {
    color: var(--aeliqo-color-text, #111827);
    display: inline-block;
    max-inline-size: 100%;
    min-inline-size: min(100%, 12rem);
    overflow-wrap: anywhere;
  }

  [part="field"] {
    display: grid;
    gap: var(--aeliqo-space-4, 0.25rem);
    min-inline-size: 0;
  }

  [part="label"] {
    display: grid;
    gap: var(--aeliqo-space-4, 0.25rem);
  }

  .label-text {
    font-weight: var(--aeliqo-typography-font-weight-semibold, 600);
  }

  [part="description"] {
    color: var(--aeliqo-color-muted, #4b5563);
    font-size: 0.9em;
  }

  [part="error"] {
    color: var(--aeliqo-color-danger, #b91c1c);
    font-size: 0.9em;
  }

  [part="pending"] {
    color: var(--aeliqo-color-muted, #4b5563);
    font-size: 0.9em;
  }

  :is(input, textarea, select, button, [role="combobox"]):focus-visible {
    outline: var(--aeliqo-focus-width, 0.1875rem) solid var(--aeliqo-color-focus, #4338ca);
    outline-offset: var(--aeliqo-focus-offset, 0.125rem);
  }

  :is(input, textarea, select) {
    background: var(--aeliqo-color-canvas, #fff);
    border: var(--aeliqo-control-border-width, 0.0625rem) solid var(--aeliqo-color-border, #64748b);
    border-radius: var(--aeliqo-radius-small, 0.375rem);
    box-sizing: border-box;
    color: inherit;
    font: inherit;
    inline-size: 100%;
    min-block-size: var(--aeliqo-control-min-target, 2.75rem);
    min-inline-size: 0;
    padding: var(--aeliqo-space-8, 0.5rem) var(--aeliqo-control-inline-padding, 0.75rem);
  }

  :is(input, textarea, select):disabled {
    background: var(--aeliqo-color-surface, #f8fafc);
    color: var(--aeliqo-color-muted, #4b5563);
    cursor: not-allowed;
    opacity: 0.72;
  }

  :is(input, textarea, select)[aria-invalid="true"] {
    border-color: var(--aeliqo-color-danger, #b91c1c);
  }

  @media (forced-colors: active) {
    :is(input, textarea, select)[aria-invalid="true"] { border-color: LinkText; }
  }
`];

/** Shared native form and validation boundary for every input primitive. */
export abstract class AeliqoFieldElement<T = unknown> extends AeliqoFoundationElement {
  static readonly formAssociated = true;

  static readonly properties = {
    label: {type: String},
    description: {type: String},
    hint: {type: String},
    error: {type: String},
    required: {type: Boolean, reflect: true},
    disabled: {type: Boolean, reflect: true},
    readOnly: {attribute: "read-only", type: Boolean, reflect: true},
    name: {type: String, reflect: true},
    autocomplete: {type: String},
    locale: {type: String},
    validationState: {attribute: "validation-state", type: String, reflect: true},
    validator: {attribute: false},
  };

  label = "";
  description = "";
  /** Legacy alias retained for the original `<aeliqo-input>` API. */
  hint = "";
  error = "";
  required = false;
  disabled = false;
  readOnly = false;
  name = "";
  autocomplete = "off";
  locale = "en-US";
  validationState: AeliqoValidationState = "idle";
  validator: AeliqoValidator<T> | undefined;

  protected formDisabled = false;
  protected readonly internals: ElementInternals | undefined;
  private currentFormValue: string | File | FormData | null = null;
  private validationSequence = 0;
  private validationAbort: AbortController | undefined;

  constructor() {
    super();
    this.internals = typeof this.attachInternals === "function" ? this.attachInternals() : undefined;
  }

  get effectiveDescription(): string {
    return this.description || this.hint;
  }

  get fieldDisabled(): boolean {
    return this.disabled || this.formDisabled;
  }

  override focus(options?: FocusOptions): void {
    const control = this.renderRoot.querySelector<HTMLElement>("[part=input], [part=control], [role=combobox]");
    control?.focus(options);
  }

  formDisabledCallback(disabled: boolean): void {
    this.formDisabled = disabled;
    // Include a reactive change key so subclasses that synchronize a native
    // control on `disabled` also refresh their form value and validity.
    this.requestUpdate("disabled", !this.disabled);
  }

  formResetCallback(): void {
    this.reset();
  }

  reset(): void {
    this.resetField();
    this.validationAbort?.abort();
    this.validationSequence += 1;
    this.validationState = "idle";
    this.error = "";
    this.requestUpdate();
  }

  formStateRestoreCallback(state: File | FormData | string | null): void {
    if (typeof state === "string") this.restoreFormState(state);
  }

  protected restoreFormState(_value: string): void {}

  disconnectedCallback(): void {
    this.validationAbort?.abort();
    this.validationAbort = undefined;
    this.validationSequence += 1;
    super.disconnectedCallback();
  }

  protected resetField(): void {}

  protected setFormValue(value: string | File | FormData | null): void {
    this.currentFormValue = value;
    if (this.fieldDisabled) {
      this.internals?.setFormValue(null);
      return;
    }
    this.internals?.setFormValue(value);
  }

  /** Public form boundary used by the compound Form primitive for slotted fields. */
  checkValidity(): boolean {
    return this.internals?.checkValidity() ?? !this.error;
  }

  reportValidity(): boolean {
    return this.internals?.reportValidity() ?? this.checkValidity();
  }

  get validationMessage(): string {
    return this.internals?.validationMessage ?? this.error;
  }

  get formValue(): string | File | FormData | null {
    return this.fieldDisabled ? null : this.currentFormValue;
  }

  protected updateValidity(anchor?: HTMLElement, valueMissing = false): void {
    if (this.internals === undefined) return;
    if (this.fieldDisabled) {
      this.internals.setValidity({});
      return;
    }
    if (this.required && !this.readOnly && valueMissing) {
      this.internals.setValidity({valueMissing: true}, this.error || "Enter a value.", anchor);
      return;
    }
    if (this.error.length > 0) {
      this.internals.setValidity({customError: true}, this.error, anchor);
      return;
    }
    this.internals.setValidity({});
  }

  protected describedByIds(): string {
    return [this.effectiveDescription ? "description" : "", this.error ? "error" : "", this.validationState === "pending" ? "pending" : ""]
      .filter((id) => id.length > 0)
      .join(" ");
  }

  protected renderMessages(): TemplateResult {
    const description = this.effectiveDescription;
    return html`
      ${description ? html`<span id="description" part="description">${description}</span>` : nothing}
      ${this.validationState === "pending" ? html`<span id="pending" part="pending" role="status">Checking…</span>` : nothing}
      ${this.error ? html`<span id="error" part="error" role="alert">${this.error}</span>` : nothing}
    `;
  }

  protected async validateProposed(value: T): Promise<void> {
    const validator = this.validator;
    this.validationAbort?.abort();
    this.validationAbort = undefined;
    this.validationSequence += 1;
    const sequence = this.validationSequence;
    if (validator === undefined) {
      this.validationState = "idle";
      this.dispatchValidation("idle", "");
      return;
    }
    const controller = new AbortController();
    this.validationAbort = controller;
    this.validationState = "pending";
    this.error = "";
    this.dispatchValidation("pending", "");
    this.requestUpdate();
    try {
      const result = await validator(value, controller.signal);
      if (controller.signal.aborted || sequence !== this.validationSequence || !this.isConnected) return;
      const normalized = this.normalizeValidationResult(result);
      this.validationState = normalized.valid ? "valid" : "invalid";
      this.error = normalized.valid ? "" : normalized.message;
      this.dispatchValidation(this.validationState, this.error);
      this.requestUpdate();
    } catch {
      if (controller.signal.aborted || sequence !== this.validationSequence || !this.isConnected) return;
      this.validationState = "invalid";
      this.error = "Validation failed.";
      this.dispatchValidation("invalid", this.error);
      this.requestUpdate();
    }
  }

  private normalizeValidationResult(result: AeliqoValidationResult): {readonly valid: boolean; readonly message: string} {
    if (result === undefined || result === true) return {valid: true, message: ""};
    if (result === false) return {valid: false, message: "Value is invalid."};
    if (typeof result === "string") return {valid: false, message: result};
    return {valid: result.valid, message: result.message ?? (result.valid ? "" : "Value is invalid.")};
  }

  private dispatchValidation(state: AeliqoValidationState, message: string): void {
    this.dispatchEvent(new AeliqoValidationEvent({source: "user", state, message}));
  }
}
