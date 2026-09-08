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

  static readonly aeliqoVersion = "0.1.0-m0";

  label = "";
  noValidate = false;

  private summary: string[] = [];

  /** Request native constraint validation and dispatch the typed host event. */
  requestSubmit(submitter?: HTMLElement): void {
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
    return nativeValid && this.slottedFields().every((control) => control.checkValidity());
  }

  reportValidity(): boolean {
    const form = this.nativeForm();
    const nativeValid = form?.reportValidity() ?? true;
    const slottedValid = this.slottedFields().every((control) => control.reportValidity?.() ?? control.checkValidity());
    return nativeValid && slottedValid;
  }

  formData(): FormData | undefined {
    const form = this.nativeForm();
    if (form === undefined) return undefined;
    const data = new FormData(form);
    for (const control of this.slottedFields()) {
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
    this.summary = this.noValidate ? [] : this.collectErrors(form);
    this.requestUpdate();
    if (this.summary.length > 0) {
      queueMicrotask(() => this.renderRoot.querySelector<HTMLElement>("[part=error-summary]")?.focus());
      return;
    }
    const submitter = submit.submitter;
    const identifier = submitter?.getAttribute("name") || submitter?.id || undefined;
    this.dispatchEvent(new AeliqoFormSubmitEvent({source: "user", submitter: identifier}));
  };

  private readonly handleReset = (event: Event): void => {
    const reset = new AeliqoFormResetEvent();
    this.dispatchEvent(reset);
    if (reset.defaultPrevented) event.preventDefault();
    if (!reset.defaultPrevented) {
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
    for (const control of this.slottedFields()) {
      if (!control.checkValidity()) {
        const label = control.getAttribute("aria-label") || ("label" in control && typeof control.label === "string" ? control.label : "") || control.getAttribute("name") || control.id || "Field";
        messages.push(`${label}: ${control.validationMessage || "Enter a valid value."}`);
      }
    }
    return messages.slice(0, 20);
  }

  private slottedFields(): Array<HTMLElement & {
    readonly formValue: string | File | FormData | null;
    readonly validationMessage: string;
    checkValidity: () => boolean;
    reset?: () => void;
    reportValidity?: () => boolean;
  }> {
    return Array.from(this.querySelectorAll<HTMLElement>("*")).filter((child): child is HTMLElement & {
      readonly formValue: string | File | FormData | null;
      readonly validationMessage: string;
      checkValidity: () => boolean;
      reset?: () => void;
      reportValidity?: () => boolean;
    } => "formValue" in child && "checkValidity" in child && typeof (child as {checkValidity?: unknown}).checkValidity === "function");
  }

  private nativeForm(): HTMLFormElement | undefined {
    const root = this.renderRoot;
    if (root === undefined || typeof root.querySelector !== "function") return undefined;
    return root.querySelector<HTMLFormElement>("form[part=form]") ?? undefined;
  }

  static readonly styles = [...aeliqoInputStyles, css`
    :host { display: block; }
    form { display: grid; gap: var(--aeliqo-space-12, 0.75rem); }
    [part=error-summary] { background: color-mix(in srgb, var(--aeliqo-color-danger, #b91c1c) 10%, transparent); border-inline-start: 0.25rem solid var(--aeliqo-color-danger, #b91c1c); padding: var(--aeliqo-space-12, 0.75rem); }
    [part=error-summary] ul { margin-block: var(--aeliqo-space-8, 0.5rem) 0; padding-inline-start: 1.25rem; }
  `];
}
