import {css, html, nothing} from "lit";
import {AeliqoFoundationElement, aeliqoFoundationThemeStyles, clampNumber} from "./base.js";
import {AeliqoSplitChangeEvent} from "./events.js";

export type AeliqoSplitOrientation = "horizontal" | "vertical";

/** Resizable two-pane layout with a typed, controlled position proposal. */
export class AeliqoSplitPaneElement extends AeliqoFoundationElement {
  static readonly properties = {
    orientation: {type: String},
    position: {type: Number},
    defaultPosition: {attribute: "default-position", type: Number},
    min: {type: Number},
    max: {type: Number},
    step: {type: Number},
    disabled: {type: Boolean, reflect: true},
  };

  static readonly aeliqoVersion = "0.1.0-m0";

  orientation: AeliqoSplitOrientation = "horizontal";
  position: number | undefined = undefined;
  defaultPosition = 50;
  min = 20;
  max = 80;
  step = 5;
  disabled = false;

  private internalPosition = 50;
  private activePointer: {readonly id: number; readonly target: HTMLElement} | undefined;

  protected override willUpdate(changed: Map<PropertyKey, unknown>): void {
    if (changed.has("defaultPosition") && this.position === undefined) this.internalPosition = this.clamped(this.defaultPosition);
  }

  protected override render() {
    const orientation = this.orientation === "vertical" ? "vertical" : "horizontal";
    const position = this.effectivePosition();
    return html`
      <div part="split" class=${`orientation-${orientation}`} style=${`--aeliqo-split-position:${position}%`}>
        <div part="start"><slot name="start"></slot></div>
        <div
          part="splitter"
          role="separator"
          tabindex=${this.disabled ? -1 : 0}
          aria-orientation=${orientation}
          aria-valuemin=${this.clamped(this.min)}
          aria-valuemax=${this.clamped(this.max)}
          aria-valuenow=${position}
          aria-valuetext=${`${Math.round(position)}%`}
          aria-disabled=${this.disabled ? "true" : nothing}
          @pointerdown=${this.handlePointerDown}
          @pointermove=${this.handlePointerMove}
          @pointerup=${this.handlePointerUp}
          @pointercancel=${this.handlePointerUp}
          @keydown=${this.handleKeyDown}
        ></div>
        <div part="end"><slot name="end"></slot></div>
      </div>
    `;
  }

  disconnectedCallback(): void {
    this.activePointer = undefined;
    super.disconnectedCallback();
  }

  private effectivePosition(): number {
    return this.position === undefined ? this.clamped(this.internalPosition) : this.clamped(this.position);
  }

  private clamped(value: number): number {
    const minimum = Number.isFinite(this.min) ? clampNumber(this.min, 0, 99) : 20;
    const maximum = Number.isFinite(this.max) ? clampNumber(this.max, minimum + 1, 100) : 80;
    return Math.round(clampNumber(Number.isFinite(value) ? value : this.defaultPosition, minimum, maximum) * 100) / 100;
  }

  private readonly handlePointerDown = (event: PointerEvent): void => {
    if (this.disabled || !(event.currentTarget instanceof HTMLElement)) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    this.activePointer = {id: event.pointerId, target: event.currentTarget};
  };

  private readonly handlePointerMove = (event: PointerEvent): void => {
    if (this.disabled || this.activePointer?.id !== event.pointerId) return;
    const bounds = this.getBoundingClientRect();
    const orientation = this.orientation === "vertical" ? "vertical" : "horizontal";
    const size = orientation === "vertical" ? bounds.height : bounds.width;
    if (size <= 0) return;
    const offset = orientation === "vertical" ? event.clientY - bounds.top : event.clientX - bounds.left;
    let next = (offset / size) * 100;
    if (orientation === "horizontal" && getComputedStyle(this).direction === "rtl") next = 100 - next;
    this.commitPosition(next);
  };

  private readonly handlePointerUp = (event: PointerEvent): void => {
    if (this.activePointer?.id !== event.pointerId) return;
    if (this.activePointer.target.hasPointerCapture(event.pointerId)) this.activePointer.target.releasePointerCapture(event.pointerId);
    this.activePointer = undefined;
  };

  private readonly handleKeyDown = (event: KeyboardEvent): void => {
    if (this.disabled) return;
    const orientation = this.orientation === "vertical" ? "vertical" : "horizontal";
    const rtl = orientation === "horizontal" && getComputedStyle(this).direction === "rtl";
    const step = Number.isFinite(this.step) && this.step > 0 ? this.step : 5;
    let next: number | undefined;
    if (event.key === "Home") next = this.clamped(this.min);
    else if (event.key === "End") next = this.clamped(this.max);
    else if (event.key === "ArrowLeft" && orientation === "horizontal") next = this.effectivePosition() - (rtl ? -step : step);
    else if (event.key === "ArrowRight" && orientation === "horizontal") next = this.effectivePosition() + (rtl ? -step : step);
    else if (event.key === "ArrowUp" && orientation === "vertical") next = this.effectivePosition() - step;
    else if (event.key === "ArrowDown" && orientation === "vertical") next = this.effectivePosition() + step;
    if (next === undefined) return;
    event.preventDefault();
    this.commitPosition(next);
  };

  private commitPosition(value: number): void {
    const position = this.clamped(value);
    if (this.position === undefined) {
      this.internalPosition = position;
      this.requestUpdate();
    }
    this.dispatchEvent(new AeliqoSplitChangeEvent({source: "user", orientation: this.orientation === "vertical" ? "vertical" : "horizontal", position}));
  }

  static readonly styles = [...aeliqoFoundationThemeStyles, css`
    :host { display: block; min-block-size: 0; min-inline-size: 0; }
    [part="split"] { display: flex; min-block-size: 0; min-inline-size: 0; }
    .orientation-horizontal { flex-direction: row; }
    .orientation-vertical { flex-direction: column; }
    [part="start"], [part="end"] { min-block-size: 0; min-inline-size: 0; overflow: auto; }
    .orientation-horizontal [part="start"] { flex: 0 1 calc(var(--aeliqo-split-position) * 1%); }
    .orientation-horizontal [part="end"] { flex: 1 1 0; }
    .orientation-vertical [part="start"] { flex: 0 1 calc(var(--aeliqo-split-position) * 1%); }
    .orientation-vertical [part="end"] { flex: 1 1 0; }
    [part="splitter"] { background: var(--aeliqo-color-border, #64748b); flex: 0 0 var(--aeliqo-control-border-width, 0.0625rem); position: relative; touch-action: none; z-index: 1; }
    .orientation-horizontal [part="splitter"] { cursor: col-resize; inline-size: 0.5rem; margin-inline: -0.25rem; }
    .orientation-vertical [part="splitter"] { block-size: 0.5rem; cursor: row-resize; margin-block: -0.25rem; }
    [part="splitter"]::after { content: ""; inset: 0.125rem; position: absolute; }
    [part="splitter"]:focus-visible { outline: var(--aeliqo-focus-width, 0.1875rem) solid var(--aeliqo-color-focus, #4338ca); outline-offset: var(--aeliqo-focus-offset, 0.125rem); }
    :host([disabled]) [part="splitter"] { cursor: not-allowed; opacity: 0.6; }
  `];
}
