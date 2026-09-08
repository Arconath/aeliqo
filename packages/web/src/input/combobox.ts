import {css, html, nothing} from "lit";
import {AeliqoFieldElement, aeliqoInputStyles} from "./base.js";
import {AeliqoInputChangeEvent} from "./events.js";
import type {AeliqoOption} from "./options.js";
import {validOptions} from "./options.js";

export type AeliqoOptionsLoader = (
  query: string,
  signal: AbortSignal,
) => readonly AeliqoOption[] | Promise<readonly AeliqoOption[]>;

const COMBOBOX_MAX_OPTIONS = 500;

/** Searchable, bounded choice control with stale-result protection. */
export class AeliqoComboboxElement extends AeliqoFieldElement<string> {
  static readonly properties = {
    ...AeliqoFieldElement.properties,
    options: {attribute: false},
    optionsLoader: {attribute: false},
    value: {type: String, reflect: true},
    defaultValue: {attribute: "default-value", type: String},
    query: {type: String},
    placeholder: {type: String},
    open: {type: Boolean, reflect: true},
    minQueryLength: {attribute: "min-query-length", type: Number},
  };

  static readonly aeliqoVersion = "0.1.0-m0";

  options: readonly AeliqoOption[] = [];
  optionsLoader: AeliqoOptionsLoader | undefined;
  value = "";
  defaultValue = "";
  query = "";
  placeholder = "";
  open = false;
  minQueryLength = 0;

  private activeIndex = -1;
  private loadSequence = 0;
  private loadAbort: AbortController | undefined;

  protected override updated(changed: Map<PropertyKey, unknown>): void {
    if (changed.has("value") && !changed.has("query")) this.query = this.labelForValue(this.value);
    if (changed.has("options") || changed.has("value") || changed.has("disabled") || changed.has("required") || changed.has("error")) {
      this.syncNative();
    }
  }

  override disconnectedCallback(): void {
    this.loadAbort?.abort();
    this.loadAbort = undefined;
    this.loadSequence += 1;
    super.disconnectedCallback();
  }

  protected override resetField(): void {
    this.value = this.defaultValue;
    this.query = this.labelForValue(this.value);
    this.open = false;
    this.activeIndex = -1;
    this.syncNative();
  }

  protected override render() {
    const options = this.safeOptions();
    const filtered = this.filteredOptions(options);
    const describedBy = this.describedByIds();
    const listId = "options";
    const selected = options.find((option) => option.value === this.value);
    return html`
      <div part="field">
        <label part="label" for="control"><span class="label-text">${this.label}</span></label>
        <div class="combobox-wrap">
          <input
            part="input"
            id="control"
            type="text"
            role="combobox"
            autocomplete=${this.autocomplete || "off"}
            .value=${this.query}
            placeholder=${this.placeholder || nothing}
            ?disabled=${this.fieldDisabled}
            ?readonly=${this.readOnly}
            aria-expanded=${this.open ? "true" : "false"}
            aria-controls=${this.open ? listId : nothing}
            aria-autocomplete="list"
            aria-activedescendant=${this.activeIndex >= 0 && filtered[this.activeIndex] ? `option-${this.activeIndex}` : nothing}
            aria-invalid=${this.error || (this.value.length > 0 && selected === undefined) ? "true" : nothing}
            aria-describedby=${describedBy || nothing}
            @input=${this.handleInput}
            @keydown=${this.handleKeyDown}
            @focus=${this.handleFocus}
            @blur=${this.handleBlur}
          />
          ${this.open ? html`
            <ul id=${listId} part="listbox" role="listbox">
              ${this.loading ? html`<li part="status" role="status">Loading…</li>` : nothing}
              ${filtered.length === 0 && !this.loading ? html`<li part="status">No options</li>` : nothing}
              ${filtered.map((option, index) => html`
                <li
                  id=${`option-${index}`}
                  part="option"
                  role="option"
                  aria-selected=${option.value === this.value ? "true" : "false"}
                  aria-disabled=${option.disabled === true ? "true" : nothing}
                  class=${index === this.activeIndex ? "active" : ""}
                  @mousedown=${(event: MouseEvent) => event.preventDefault()}
                  @click=${() => this.choose(option)}
                >
                  <span>${option.label}</span>
                  ${option.description ? html`<small>${option.description}</small>` : nothing}
                </li>
              `)}
            </ul>
          ` : nothing}
        </div>
        ${this.renderMessages()}
      </div>
    `;
  }

  override focus(options?: FocusOptions): void {
    this.native()?.focus(options);
  }

  get loading(): boolean {
    return this.validationState === "pending";
  }

  private readonly handleFocus = (): void => {
    if (!this.fieldDisabled && !this.readOnly) {
      this.open = true;
      this.activeIndex = this.firstEnabledIndex(this.filteredOptions(this.safeOptions()));
    }
  };

  private readonly handleBlur = (): void => {
    // A click is allowed to run before the delayed close, while focus remains
    // on the input after a selection.
    setTimeout(() => {
      if (!this.isConnected) return;
      const root = this.renderRoot;
      const active = this.shadowRoot?.activeElement;
      if (active !== this.native()) this.open = false;
    }, 0);
  };

  private readonly handleInput = (event: Event): void => {
    const input = event.target;
    if (!(input instanceof HTMLInputElement) || this.fieldDisabled || this.readOnly) return;
    this.query = input.value;
    this.value = "";
    this.activeIndex = this.firstEnabledIndex(this.filteredOptions(this.safeOptions()));
    this.open = true;
    this.dispatchEvent(new AeliqoInputChangeEvent({source: "user", value: this.query}));
    void this.loadForQuery(this.query);
    this.syncNative();
  };

  private readonly handleKeyDown = (event: KeyboardEvent): void => {
    if (this.fieldDisabled || this.readOnly) return;
    const options = this.filteredOptions(this.safeOptions());
    if (event.key === "ArrowDown") {
      event.preventDefault();
      this.open = true;
      this.activeIndex = this.nextEnabledIndex(options, this.activeIndex, 1);
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      this.open = true;
      this.activeIndex = this.nextEnabledIndex(options, this.activeIndex, -1);
      return;
    }
    if (event.key === "Escape") {
      if (this.open) {
        event.preventDefault();
        this.open = false;
      }
      return;
    }
    if (event.key === "Enter" && this.open && this.activeIndex >= 0) {
      const option = options[this.activeIndex];
      if (option !== undefined) {
        event.preventDefault();
        this.choose(option);
      }
    }
  };

  private choose(option: AeliqoOption): void {
    if (option.disabled === true || this.fieldDisabled || this.readOnly) return;
    this.value = option.value;
    this.query = option.label;
    this.open = false;
    this.activeIndex = -1;
    this.dispatchEvent(new AeliqoInputChangeEvent({source: "user", value: this.value}));
    void this.validateProposed(this.value);
    this.syncNative();
    this.native()?.focus();
  }

  private async loadForQuery(query: string): Promise<void> {
    const loader = this.optionsLoader;
    if (loader === undefined) return;
    this.loadAbort?.abort();
    const controller = new AbortController();
    this.loadAbort = controller;
    const sequence = ++this.loadSequence;
    if (query.length < Math.max(0, this.minQueryLength)) {
      this.validationState = "idle";
      return;
    }
    this.validationState = "pending";
    this.requestUpdate();
    try {
      const loaded = await loader(query, controller.signal);
      if (controller.signal.aborted || sequence !== this.loadSequence || !this.isConnected) return;
      this.options = validOptions(loaded) ? loaded.slice(0, COMBOBOX_MAX_OPTIONS) : [];
      this.validationState = "idle";
      this.activeIndex = this.firstEnabledIndex(this.filteredOptions(this.options));
      this.requestUpdate();
    } catch {
      if (controller.signal.aborted || sequence !== this.loadSequence || !this.isConnected) return;
      this.validationState = "invalid";
      this.error = "Options could not be loaded.";
      this.requestUpdate();
    }
  }

  private safeOptions(): readonly AeliqoOption[] {
    return validOptions(this.options) ? this.options.slice(0, COMBOBOX_MAX_OPTIONS) : [];
  }

  private filteredOptions(options: readonly AeliqoOption[]): readonly AeliqoOption[] {
    const query = this.query.trim().toLocaleLowerCase(this.locale || undefined);
    if (query.length === 0) return options;
    return options.filter((option) => `${option.label} ${option.description ?? ""}`.toLocaleLowerCase(this.locale || undefined).includes(query));
  }

  private labelForValue(value: string): string {
    return this.safeOptions().find((option) => option.value === value)?.label ?? value;
  }

  private firstEnabledIndex(options: readonly AeliqoOption[]): number {
    return options.findIndex((option) => option.disabled !== true);
  }

  private nextEnabledIndex(options: readonly AeliqoOption[], current: number, direction: 1 | -1): number {
    if (options.length === 0) return -1;
    for (let offset = 1; offset <= options.length; offset += 1) {
      const index = (current + direction * offset + options.length * 2) % options.length;
      if (options[index]?.disabled !== true) return index;
    }
    return -1;
  }

  private native(): HTMLInputElement | undefined {
    const root = this.renderRoot;
    if (root === undefined || typeof root.querySelector !== "function") return undefined;
    return root.querySelector<HTMLInputElement>("input[part=input]") ?? undefined;
  }

  private syncNative(): void {
    const selected = this.safeOptions().some((option) => option.value === this.value && option.disabled !== true);
    this.setFormValue(this.fieldDisabled || !selected ? null : this.value);
    this.updateValidity(this.native(), this.value.length === 0 || !selected);
  }

  static readonly styles = [...aeliqoInputStyles, css`
    .combobox-wrap { position: relative; }
    [part=listbox] { background: var(--aeliqo-color-canvas, #fff); border: 1px solid var(--aeliqo-color-border, #64748b); border-radius: var(--aeliqo-radius-small, 0.375rem); box-shadow: 0 0.25rem 0.75rem rgb(15 23 42 / 18%); list-style: none; margin: 0.25rem 0 0; max-block-size: 16rem; overflow: auto; padding: 0.25rem; position: absolute; inset-inline: 0; z-index: 1; }
    [part=option], [part=status] { cursor: default; display: flex; gap: 0.5rem; justify-content: space-between; min-block-size: var(--aeliqo-control-min-target, 2.75rem); padding: 0.65rem 0.75rem; }
    [part=option] small { color: var(--aeliqo-color-muted, #4b5563); }
    [part=option].active { background: var(--aeliqo-color-surface, #f1f5f9); }
    [part=option][aria-disabled=true] { color: var(--aeliqo-color-muted, #4b5563); }
  `];
}
