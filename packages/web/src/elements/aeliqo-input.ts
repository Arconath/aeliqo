import {css, html, LitElement, noChange, nothing} from "lit";
import type {PropertyValues} from "lit";
import {AeliqoInputEvent} from "../events.js";

const BLOCKING_INPUT_TYPES = new Set([
  "text",
  "search",
  "url",
  "tel",
  "email",
  "password",
  "date",
  "month",
  "week",
  "time",
  "datetime-local",
  "number",
]);

/** A user edit proposed by the native control inside `<aeliqo-input>`. */
export class AeliqoInputElement extends LitElement {
  static readonly formAssociated = true;

  static readonly shadowRootOptions: ShadowRootInit = {
    mode: "open",
    delegatesFocus: true,
  };

  static readonly properties = {
    label: {type: String},
    value: {type: String, reflect: true},
    defaultValue: {attribute: "default-value", type: String},
    name: {type: String, reflect: true},
    hint: {type: String},
    error: {type: String},
    required: {type: Boolean, reflect: true},
    disabled: {type: Boolean, reflect: true},
    readOnly: {attribute: "read-only", type: Boolean, reflect: true},
  };

  static readonly aeliqoVersion = "0.1.0-m0";

  label = "";
  value = "";
  defaultValue = "";
  name = "";
  hint = "";
  error = "";
  required = false;
  disabled = false;
  readOnly = false;

  private formDisabled = false;
  private composing = false;
  private lastComposingProposal: string | undefined;
  private suppressTrailingCompositionInput: string | undefined;
  private pendingSelection: {readonly start: number; readonly end: number} | undefined;
  private hydratedDraft: string | undefined;
  private readonly internals: ElementInternals | undefined;

  constructor() {
    super();
    const prerenderedInput = this.shadowRoot?.querySelector<HTMLInputElement>("input[part='input']");
    if (prerenderedInput != null) {
      this.hydratedDraft = prerenderedInput.value;
    }
    this.internals =
      typeof this.attachInternals === "function" ? this.attachInternals() : undefined;
  }

  override connectedCallback(): void {
    if (this.hydratedDraft !== undefined) {
      this.value = this.hydratedDraft;
      this.hydratedDraft = undefined;
    }
    super.connectedCallback();
  }

  protected override updated(changed: PropertyValues<this>): void {
    if (
      changed.has("value") ||
      changed.has("disabled") ||
      changed.has("required") ||
      changed.has("error") ||
      changed.has("readOnly")
    ) {
      this.syncNativeInput();
    }
  }

  protected override willUpdate(changed: PropertyValues<this>): void {
    if (!changed.has("value")) {
      return;
    }

    const input = this.getNativeInput();
    if (input !== undefined && this.shadowRoot?.activeElement === input) {
      const start = input.selectionStart;
      const end = input.selectionEnd;
      if (start !== null && end !== null) {
        this.pendingSelection = {start, end};
      }
    }
  }

  protected override render() {
    const disabled = this.disabled || this.formDisabled;
    const describedBy = [this.hint ? "description" : "", this.error ? "error" : ""]
      .filter((id) => id.length > 0)
      .join(" ");

    return html`
      <div part="field">
        <label part="label">
          <span class="label-text">${this.label}</span>
          <input
            part="input"
            .value=${this.composing ? noChange : this.value}
            name=""
            ?required=${this.required}
            ?disabled=${disabled}
            ?readonly=${this.readOnly}
            aria-invalid=${this.error ? "true" : nothing}
            aria-describedby=${describedBy || nothing}
            @input=${this.handleInput}
            @keydown=${this.handleKeyDown}
            @compositionstart=${this.handleCompositionStart}
            @compositionend=${this.handleCompositionEnd}
          />
        </label>
        ${this.hint ? html`<span id="description" part="description">${this.hint}</span>` : nothing}
        ${this.error ? html`<span id="error" part="error">${this.error}</span>` : nothing}
      </div>
    `;
  }

  override focus(options?: FocusOptions): void {
    this.getNativeInput()?.focus(options);
  }

  formResetCallback(): void {
    this.value = this.defaultValue;
    this.syncNativeInput();
  }

  formDisabledCallback(disabled: boolean): void {
    this.formDisabled = disabled;
    this.requestUpdate();
    this.syncNativeInput();
  }

  formStateRestoreCallback(state: File | FormData | string | null): void {
    if (typeof state === "string") {
      this.value = state;
      this.syncNativeInput();
    }
  }

  private readonly handleInput = (event: Event): void => {
    const input = event.target;
    if (!(input instanceof HTMLInputElement)) {
      return;
    }

    if (!this.composing && this.suppressTrailingCompositionInput !== undefined) {
      const expected = this.suppressTrailingCompositionInput;
      this.suppressTrailingCompositionInput = undefined;
      if (input.value === expected || input.value === this.value) {
        this.syncNativeInput();
        return;
      }
    }

    if (this.composing) {
      this.lastComposingProposal = input.value;
    }
    this.dispatchEvent(new AeliqoInputEvent({value: input.value, source: "user"}));
    // The host decides whether a proposal is accepted. Reconcile immediately
    // after dispatch so a rejected controlled edit cannot become form data.
    if (!this.composing) {
      this.syncNativeInput();
    }
  };

  private readonly handleCompositionStart = (): void => {
    this.composing = true;
    this.lastComposingProposal = undefined;
    this.suppressTrailingCompositionInput = undefined;
  };

  private readonly handleCompositionEnd = (): void => {
    const input = this.getNativeInput();
    const finalValue = input?.value;
    const alreadyProposed = finalValue !== undefined && this.lastComposingProposal === finalValue;
    this.composing = false;
    this.lastComposingProposal = undefined;
    if (finalValue !== undefined) {
      this.suppressTrailingCompositionInput = finalValue;
      if (!alreadyProposed) {
        this.dispatchEvent(new AeliqoInputEvent({value: finalValue, source: "user"}));
      }
    }
    this.syncNativeInput();
  };

  private readonly handleKeyDown = (event: KeyboardEvent): void => {
    if (
      event.key !== "Enter" ||
      event.repeat ||
      event.isComposing ||
      this.composing ||
      this.disabled ||
      this.formDisabled
    ) {
      return;
    }

    const form = this.internals?.form;
    if (form === null || form === undefined) {
      return;
    }

    setTimeout(() => {
      if (
        event.defaultPrevented ||
        !this.isConnected ||
        this.internals?.form !== form ||
        this.composing ||
        event.isComposing ||
        this.disabled ||
        this.formDisabled
      ) {
        return;
      }

      const submitter = this.getDefaultSubmitter(form);
      if (submitter === null || (submitter === undefined && !this.hasSingleBlockingField(form))) {
        event.preventDefault();
        return;
      }

      event.preventDefault();
      if (submitter === undefined) {
        form.requestSubmit();
      } else {
        submitter.click();
      }
    }, 0);
  };

  private getDefaultSubmitter(
    form: HTMLFormElement,
  ): HTMLButtonElement | HTMLInputElement | null | undefined {
    const root = form.getRootNode();
    if (!(root instanceof Document || root instanceof DocumentFragment)) {
      return undefined;
    }

    for (const control of root.querySelectorAll<HTMLButtonElement | HTMLInputElement>("button, input")) {
      if (control.form !== form) {
        continue;
      }
      if (control instanceof HTMLButtonElement && control.type === "submit") {
        return control.matches(":disabled") ? null : control;
      }
      if (control instanceof HTMLInputElement && (control.type === "submit" || control.type === "image")) {
        return control.matches(":disabled") ? null : control;
      }
    }
    return undefined;
  }

  private hasSingleBlockingField(form: HTMLFormElement): boolean {
    let count = 0;
    for (const control of Array.from(form.elements)) {
      if (control.matches(":disabled")) {
        continue;
      }

      if (control instanceof AeliqoInputElement) {
        count += 1;
      } else if (control instanceof HTMLInputElement && BLOCKING_INPUT_TYPES.has(control.type)) {
        count += 1;
      }

      if (count > 1) {
        return false;
      }
    }
    return true;
  }

  private getNativeInput(): HTMLInputElement | undefined {
    const root = this.renderRoot;
    if (root === undefined || typeof root.querySelector !== "function") {
      return undefined;
    }
    const input = root.querySelector<HTMLInputElement>("input[part='input']");
    return input ?? undefined;
  }

  private syncNativeInput(): void {
    const input = this.getNativeInput();
    if (input === undefined) {
      this.updateFormValue(this.value);
      return;
    }

    const hasFocus = this.shadowRoot?.activeElement === input;
    const selection = this.pendingSelection ?? {
      start: input.selectionStart,
      end: input.selectionEnd,
    };
    if (!this.composing && input.value !== this.value) {
      input.value = this.value;
    }
    input.name = "";
    input.required = this.required;
    input.disabled = this.disabled || this.formDisabled;
    input.readOnly = this.readOnly;
    this.updateFormValue(input.value);

    if (hasFocus && selection.start !== null && selection.end !== null) {
      input.setSelectionRange(selection.start, selection.end);
    }
    this.pendingSelection = undefined;
  }

  private updateFormValue(value: string): void {
    if (this.internals === undefined) {
      return;
    }

    const disabled = this.disabled || this.formDisabled;
    this.internals.setFormValue(disabled ? null : value);

    if (disabled) {
      this.internals.setValidity({});
      return;
    }

    if (this.required && !this.readOnly && value.length === 0) {
      this.internals.setValidity(
        {valueMissing: true},
        this.error || "Enter a value.",
        this.getNativeInput(),
      );
      return;
    }

    if (this.error) {
      this.internals.setValidity({customError: true}, this.error, this.getNativeInput());
      return;
    }

    this.internals.setValidity({});
  }

  static readonly styles = css`
    :host {
      color: var(--aeliqo-input-color, #18202a);
      display: inline-block;
      font: inherit;
      max-inline-size: 100%;
    }

    label {
      display: grid;
      gap: 0.35rem;
    }

    [part="field"] {
      display: grid;
      gap: 0.35rem;
    }

    .label-text {
      font-weight: 600;
    }

    input {
      background: var(--aeliqo-input-background, #fff);
      border: 1px solid var(--aeliqo-input-border, #65707d);
      border-radius: 0.35rem;
      color: inherit;
      font: inherit;
      min-block-size: 2.5rem;
      min-inline-size: 12rem;
      padding: 0.45rem 0.65rem;
    }

    input:focus-visible {
      outline: 0.2rem solid var(--aeliqo-input-focus, #0b63ce);
      outline-offset: 0.15rem;
    }

    [part="description"] {
      color: var(--aeliqo-input-description, #495464);
      font-size: 0.9em;
    }

    [part="error"] {
      color: var(--aeliqo-input-error, #a32929);
      font-size: 0.9em;
    }
  `;
}
