import {css, html, nothing} from "lit";
import {AeliqoActionElement, type AeliqoActionType} from "./action-base.js";
import {aeliqoFoundationThemeStyles} from "./base.js";

export type AeliqoButtonVariant = "solid" | "outline" | "ghost" | "danger";
export type AeliqoButtonSize = "small" | "medium" | "large";

/** Native button behavior with an explicit, cancellable application action proposal. */
export class AeliqoButtonElement extends AeliqoActionElement {
  static readonly properties = {
    disabled: {type: Boolean, reflect: true},
    pending: {type: Boolean, reflect: true},
    type: {type: String},
    name: {type: String, reflect: true},
    value: {type: String},
    label: {type: String},
    variant: {type: String},
    size: {type: String},
  };

  static readonly aeliqoVersion = "0.1.0";

  label = "";
  variant: AeliqoButtonVariant = "solid";
  size: AeliqoButtonSize = "medium";

  override type: AeliqoActionType = "button";

  protected override render() {
    const variant = this.variant === "outline" || this.variant === "ghost" || this.variant === "danger" ? this.variant : "solid";
    const size = this.size === "small" || this.size === "large" ? this.size : "medium";
    return html`
      <button
        part="button"
        type=${this.actionType}
        name=${this.name || nothing}
        value=${this.value || nothing}
        class=${`variant-${variant} size-${size}`}
        ?disabled=${this.actionDisabled}
        aria-busy=${this.pending ? "true" : nothing}
        @click=${(event: Event) => this.handleActionClick(event, "button")}
      >
        <slot>${this.label}</slot>
        ${this.pending ? html`<span part="pending" aria-hidden="true"></span>` : nothing}
      </button>
    `;
  }

  static readonly styles = [...aeliqoFoundationThemeStyles, css`
    :host {
      display: inline-block;
      max-inline-size: 100%;
    }

    button {
      align-items: center;
      border: var(--aeliqo-control-border-width, 0.0625rem) solid transparent;
      border-radius: var(--aeliqo-radius-medium, 0.625rem);
      cursor: pointer;
      display: inline-flex;
      font: inherit;
      gap: var(--aeliqo-space-8, 0.5rem);
      justify-content: center;
      max-inline-size: 100%;
      min-block-size: var(--aeliqo-control-min-target, 2.75rem);
      padding-inline: var(--aeliqo-control-inline-padding, 0.75rem);
      white-space: normal;
    }

    button:disabled {
      cursor: not-allowed;
      opacity: 0.62;
    }

    button.variant-solid {
      background: var(--aeliqo-color-accent, #4338ca);
      color: var(--aeliqo-color-on-accent, #fff);
    }

    button.variant-outline {
      background: transparent;
      border-color: var(--aeliqo-color-accent, #4338ca);
      color: var(--aeliqo-color-accent, #4338ca);
    }

    button.variant-ghost {
      background: transparent;
      color: var(--aeliqo-color-accent, #4338ca);
    }

    button.variant-danger {
      background: var(--aeliqo-color-danger, #b91c1c);
      color: var(--aeliqo-color-on-accent, #fff);
    }

    button:not(:disabled):hover {
      filter: brightness(0.96);
    }

    button.size-small {
      min-block-size: var(--aeliqo-control-compact-target, 2rem);
      padding-inline: var(--aeliqo-space-8, 0.5rem);
    }

    button.size-large {
      min-block-size: 3.25rem;
      padding-inline: var(--aeliqo-space-16, 1rem);
    }

    [part="pending"] {
      animation: aeliqo-button-pending 0.9s linear infinite;
      block-size: 0.9em;
      border: 0.125rem solid currentColor;
      border-block-end-color: transparent;
      border-radius: 50%;
      inline-size: 0.9em;
    }

    @keyframes aeliqo-button-pending {
      to { transform: rotate(360deg); }
    }

    @media (prefers-reduced-motion: reduce) {
      [part="pending"] { animation-duration: 0ms; }
    }
    @media (forced-colors: active) {
      button:is(.variant-solid, .variant-outline, .variant-ghost, .variant-danger) {
        background: ButtonFace;
        color: ButtonText;
        border-color: ButtonText;
      }
      button:not(:disabled):hover { filter: none; }
      button:disabled { color: GrayText; border-color: GrayText; }
    }
  `];
}
