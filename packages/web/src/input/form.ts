import {css, html, nothing} from "lit";
import {AeliqoFoundationElement} from "../foundation/base.js";
import {AeliqoFormResetEvent, AeliqoFormSubmitEvent} from "./events.js";
import {aeliqoInputStyles} from "./base.js";

/** Native form boundary with explicit host-controlled submit handling. */
export class AeliqoFormElement extends AeliqoFoundationElement {
  static readonly properties = {
    label: {type: String},
    noValidate: {attribute: "no-validate", type: Boolean},
  };

  static readonly aeliqoVersion = "0.1.0";

  label = "";
  noValidate = false;

  private summary: string[] = [];

  override connectedCallback(): void {
    super.connectedCallback();
    this.addEventListener("click", this.handleSlottedClick);
    this.addEventListener("keydown", this.handleSlottedKeyDown);
  }

  override disconnectedCallback(): void {
    this.removeEventListener("click", this.handleSlottedClick);
    this.removeEventListener("keydown", this.handleSlottedKeyDown);
    super.disconnectedCallback();
  }

  /** Request native constraint validation and dispatch the typed host event. */
  requestSubmit(submitter?: HTMLElement): void {
    if (submitter !== undefined && this.slottedNativeControls().includes(submitter as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | HTMLButtonElement)) {
      if (this.isEffectivelyDisabled(submitter)) return;
      this.submitSlotted(submitter);
      return;
    }
    const form = this.nativeForm();
    if (form === undefined) return;
    if (submitter instanceof HTMLButtonElement || submitter instanceof HTMLInputElement) form.requestSubmit(submitter);
    else form.requestSubmit();
  }

  reset(): void {
    this.nativeForm()?.reset();
  }

  checkValidity(): boolean {
    const form = this.nativeForm();
    const nativeValid = form?.checkValidity() ?? true;
    const slottedNativeValid = this.slottedNativeControls().every((control) => control.checkValidity());
    return nativeValid && slottedNativeValid && this.slottedFields().every((control) => this.isEffectivelyDisabled(control) || control.checkValidity());
  }

  reportValidity(): boolean {
    const form = this.nativeForm();
    const nativeValid = form?.reportValidity() ?? true;
    const slottedNativeValid = this.slottedNativeControls().every((control) => control.reportValidity());
    const slottedValid = this.slottedFields().every((control) => this.isEffectivelyDisabled(control) || (control.reportValidity?.() ?? control.checkValidity()));
    return nativeValid && slottedNativeValid && slottedValid;
  }

  formData(): FormData | undefined {
    const form = this.nativeForm();
    if (form === undefined) return undefined;
    const data = new FormData(form);
    for (const control of this.slottedNativeControls()) {
      if (this.isEffectivelyDisabled(control) || control.form !== null || !control.name) continue;
      if (control instanceof HTMLInputElement && ((control.type === "checkbox" || control.type === "radio") && !control.checked)) continue;
      if (control instanceof HTMLButtonElement || (control instanceof HTMLInputElement && (control.type === "submit" || control.type === "reset" || control.type === "button" || control.type === "image"))) continue;
      this.appendNativeControlValue(data, control);
    }
    for (const control of this.slottedFields()) {
      if (this.isEffectivelyDisabled(control)) continue;
      const name = control.getAttribute("name") || ("name" in control && typeof control.name === "string" ? control.name : "");
      const value = control.formValue;
      if (!name || value === null || value === undefined) continue;
      if (value instanceof FormData) {
        for (const [key, entry] of value.entries()) data.append(key, entry);
      } else {
        data.append(name, value);
      }
    }
    return data;
  }

  protected override render() {
    return html`
      <form part="form" novalidate=${this.noValidate ? "" : nothing} @submit=${this.handleSubmit} @reset=${this.handleReset}>
        ${this.summary.length > 0 ? html`
          <div part="error-summary" role="alert" tabindex="-1">
            <strong>${this.label || "Please correct the errors"}</strong>
            <ul>${this.summary.map((message) => html`<li>${message}</li>`)}</ul>
          </div>
        ` : nothing}
        <slot></slot>
      </form>
    `;
  }

  private readonly handleSubmit = (event: Event): void => {
    const submit = event as SubmitEvent;
    const form = event.currentTarget;
    if (!(form instanceof HTMLFormElement)) return;
    event.preventDefault();
    const submitter = submit.submitter;
    this.summary = this.noValidate || this.submitterSkipsValidation(submitter) ? [] : this.collectErrors(form);
    this.requestUpdate();
    if (this.summary.length > 0) {
      queueMicrotask(() => this.renderRoot.querySelector<HTMLElement>("[part=error-summary]")?.focus());
      return;
    }
    this.emitSubmit(submitter);
  };

  private emitSubmit(submitter: HTMLElement | null): void {
    const identifier = submitter?.getAttribute("name") || submitter?.id || undefined;
    this.dispatchEvent(new AeliqoFormSubmitEvent({source: "user", submitter: identifier}));
  }

  private readonly handleSlottedClick = (event: Event): void => {
    if (event.defaultPrevented || !this.ownsEvent(event)) return;
    const target = this.nativeControlFromEvent(event);
    if (!(target instanceof HTMLButtonElement) && !(target instanceof HTMLInputElement)) return;
    if (this.isEffectivelyDisabled(target) || target.form !== null) return;
    if (target.type === "reset") {
      event.preventDefault();
      this.reset();
    } else if (target.type === "submit" || target.type === "image") {
      event.preventDefault();
      this.submitSlotted(target);
    }
  };

  private readonly handleSlottedKeyDown = (event: Event): void => {
    const key = event as KeyboardEvent;
    const owned = this.ownsEvent(event);
    if (key.key !== "Enter" || key.repeat || key.isComposing || key.defaultPrevented || !owned) return;
    const native = this.nativeControlFromEvent(event);
    if (native !== undefined && native.form !== null) return;
    if (this.eventFormOwner(event) !== null) return;
    if (native instanceof HTMLTextAreaElement || native instanceof HTMLSelectElement) return;
    if (native instanceof HTMLButtonElement || (native instanceof HTMLInputElement && ["checkbox", "radio", "range", "file", "submit", "reset", "button", "image"].includes(native.type))) return;
    event.preventDefault();
    this.submitSlotted(this.defaultSlottedSubmitter());
  };

  private submitSlotted(submitter: HTMLElement | null): void {
    const form = this.nativeForm();
    if (form === undefined) return;
    if (submitter !== null && this.isEffectivelyDisabled(submitter)) return;
    this.summary = this.noValidate || this.submitterSkipsValidation(submitter) ? [] : this.collectErrors(form);
    this.requestUpdate();
    if (this.summary.length > 0) return;
    this.emitSubmit(submitter);
  }

  private defaultSlottedSubmitter(): HTMLButtonElement | HTMLInputElement | null {
    for (const control of this.slottedNativeControls()) {
      if (this.isEffectivelyDisabled(control) || control.form !== null) continue;
      if (control instanceof HTMLButtonElement && control.type === "submit") return control;
      if (control instanceof HTMLInputElement && (control.type === "submit" || control.type === "image")) return control;
    }
    return null;
  }

  private submitterSkipsValidation(submitter: HTMLElement | null): boolean {
    return submitter instanceof HTMLButtonElement || submitter instanceof HTMLInputElement ? submitter.formNoValidate : false;
  }

  private readonly handleReset = (event: Event): void => {
    const reset = new AeliqoFormResetEvent();
    this.dispatchEvent(reset);
    if (reset.defaultPrevented) event.preventDefault();
    if (!reset.defaultPrevented) {
      this.resetSlottedNativeControls();
      for (const control of this.slottedFields()) control.reset?.();
    }
    this.summary = [];
    this.requestUpdate();
  };

  private collectErrors(form: HTMLFormElement): string[] {
    const messages: string[] = [];
    for (const control of Array.from(form.elements)) {
      if (!("checkValidity" in control) || typeof control.checkValidity !== "function") continue;
      if (!control.checkValidity()) {
        const label = control.getAttribute("aria-label") || control.getAttribute("name") || control.id || "Field";
        const message = "validationMessage" in control && typeof control.validationMessage === "string" ? control.validationMessage : "";
        messages.push(`${label}: ${message || "Enter a valid value."}`);
      }
    }
    for (const control of this.slottedNativeControls()) {
      if (!this.isEffectivelyDisabled(control) && control.form === null && !control.checkValidity()) messages.push(this.nativeControlError(control));
    }
    for (const control of this.slottedFields()) {
      if (!this.isEffectivelyDisabled(control) && !control.checkValidity()) {
        const label = control.getAttribute("aria-label") || ("label" in control && typeof control.label === "string" ? control.label : "") || control.getAttribute("name") || control.id || "Field";
        messages.push(`${label}: ${control.validationMessage || "Enter a valid value."}`);
      }
    }
    return messages.slice(0, 20);
  }

  private slottedFields(): Array<HTMLElement & {
    readonly formValue: string | File | FormData | null;
    readonly formOwner?: HTMLFormElement | null;
    readonly validationMessage: string;
    checkValidity: () => boolean;
    reset?: () => void;
    reportValidity?: () => boolean;
  }> {
    return Array.from(this.querySelectorAll<HTMLElement>("*")).filter((child): child is HTMLElement & {
      readonly formValue: string | File | FormData | null;
      readonly formOwner?: HTMLFormElement | null;
      readonly validationMessage: string;
      checkValidity: () => boolean;
      reset?: () => void;
      reportValidity?: () => boolean;
    } => child.closest("aeliqo-form") === this && "formValue" in child && "checkValidity" in child && typeof (child as {checkValidity?: unknown}).checkValidity === "function" && ((child as {formOwner?: HTMLFormElement | null}).formOwner ?? null) === null);
  }

  private slottedNativeControls(): Array<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | HTMLButtonElement> {
    return Array.from(this.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | HTMLButtonElement>("input, select, textarea, button"))
      .filter((control) => control.closest("aeliqo-form") === this);
  }

  private nativeControlFromEvent(event: Event): HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | HTMLButtonElement | undefined {
    return event.composedPath().find((target): target is HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | HTMLButtonElement =>
      target instanceof HTMLInputElement || target instanceof HTMLSelectElement || target instanceof HTMLTextAreaElement || target instanceof HTMLButtonElement,
    );
  }

  private eventFormOwner(event: Event): HTMLFormElement | null {
    const owner = event.composedPath().find((target): target is HTMLElement & {readonly formOwner?: HTMLFormElement | null} =>
      target instanceof HTMLElement && "formOwner" in target,
    );
    return owner?.formOwner ?? null;
  }

  private ownsEvent(event: Event): boolean {
    const owner = event.composedPath().find((target): target is AeliqoFormElement => target instanceof AeliqoFormElement);
    return owner === this;
  }

  private isEffectivelyDisabled(control: HTMLElement): boolean {
    return control.matches(":disabled") || control.closest("fieldset:disabled") !== null;
  }

  private resetSlottedNativeControls(): void {
    for (const control of this.slottedNativeControls()) {
      if (control instanceof HTMLInputElement) {
        if (control.type === "checkbox" || control.type === "radio") {
          control.checked = control.defaultChecked;
          control.indeterminate = false;
        }
        else if (control.type !== "button" && control.type !== "submit" && control.type !== "reset" && control.type !== "image") control.value = control.defaultValue;
      } else if (control instanceof HTMLTextAreaElement) {
        control.value = control.defaultValue;
      } else if (control instanceof HTMLSelectElement) {
        const options = Array.from(control.options);
        const hasDefault = options.some((option) => option.defaultSelected);
        for (const option of options) option.selected = option.defaultSelected;
        if (!hasDefault && options[0] !== undefined) options[0].selected = true;
      }
    }
  }

  private appendNativeControlValue(data: FormData, control: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | HTMLButtonElement): void {
    if (control instanceof HTMLInputElement && control.type === "file") {
      for (const file of Array.from(control.files ?? [])) data.append(control.name, file);
      return;
    }
    if (control instanceof HTMLSelectElement && control.multiple) {
      for (const option of Array.from(control.selectedOptions)) data.append(control.name, option.value);
      return;
    }
    if (control instanceof HTMLButtonElement) return;
    data.append(control.name, control.value);
  }

  private nativeControlError(control: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | HTMLButtonElement): string {
    const label = control.getAttribute("aria-label") || control.getAttribute("name") || control.id || "Field";
    return `${label}: ${control.validationMessage || "Enter a valid value."}`;
  }

  private nativeForm(): HTMLFormElement | undefined {
    const root = this.renderRoot;
    if (root === undefined || typeof root.querySelector !== "function") return undefined;
    return root.querySelector<HTMLFormElement>("form[part=form]") ?? undefined;
  }

  static readonly styles = [...aeliqoInputStyles, css`
    :host { display: block; }
    form { display: grid; gap: var(--aeliqo-space-12, 0.75rem); }
    ::slotted(button) { background: var(--aeliqo-color-surface, #f8fafc); border: var(--aeliqo-control-border-width, .0625rem) solid var(--aeliqo-color-border, #64748b); color: var(--aeliqo-color-text, #111827); font: inherit; min-block-size: var(--aeliqo-control-min-target, 2.75rem); min-inline-size: var(--aeliqo-control-min-target, 2.75rem); padding: var(--aeliqo-space-8, .5rem) var(--aeliqo-control-inline-padding, .875rem); }
    @media (forced-colors: active) { ::slotted(button) { background: Canvas; color: CanvasText; } }
    [part=error-summary] { background: color-mix(in srgb, var(--aeliqo-color-danger, #b91c1c) 10%, transparent); border-inline-start: 0.25rem solid var(--aeliqo-color-danger, #b91c1c); padding: var(--aeliqo-space-12, 0.75rem); }
    [part=error-summary] ul { margin-block: var(--aeliqo-space-8, 0.5rem) 0; padding-inline-start: 1.25rem; }
  `];
}
