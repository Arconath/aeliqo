import {css, html} from "lit";
import {AeliqoFoundationElement, aeliqoFoundationThemeStyles} from "./base.js";

export type AeliqoBadgeTone = "neutral" | "info" | "success" | "warning" | "danger";

/** Text-first status/category marker; tone never carries the only meaning. */
export class AeliqoBadgeElement extends AeliqoFoundationElement {
  static readonly properties = {
    text: {type: String},
    tone: {type: String},
  };

  static readonly aeliqoVersion = "0.1.0";

  text = "";
  tone: AeliqoBadgeTone = "neutral";

  protected override render() {
    const tone = this.tone === "info" || this.tone === "success" || this.tone === "warning" || this.tone === "danger" ? this.tone : "neutral";
    return html`<span part="badge" class=${`tone-${tone}`}><slot>${this.text}</slot></span>`;
  }

  static readonly styles = [...aeliqoFoundationThemeStyles, css`
    :host { display: inline-block; max-inline-size: 100%; }
    [part="badge"] {
      background: var(--aeliqo-color-surface, #f8fafc);
      border: var(--aeliqo-control-border-width, 0.0625rem) solid var(--aeliqo-color-border, #64748b);
      border-radius: 999px;
      color: var(--aeliqo-color-text, #111827);
      display: inline-flex;
      font-size: var(--aeliqo-typography-font-size-caption, 0.75rem);
      font-weight: var(--aeliqo-typography-font-weight-semibold, 600);
      max-inline-size: 100%;
      overflow-wrap: anywhere;
      padding: var(--aeliqo-space-4, 0.25rem) var(--aeliqo-space-8, 0.5rem);
    }
    .tone-info { border-color: var(--aeliqo-color-info, #1d4ed8); color: var(--aeliqo-color-info, #1d4ed8); }
    .tone-success { border-color: var(--aeliqo-color-success, #166534); color: var(--aeliqo-color-success, #166534); }
    .tone-warning { border-color: var(--aeliqo-color-warning, #854d0e); color: var(--aeliqo-color-warning, #854d0e); }
    .tone-danger { border-color: var(--aeliqo-color-danger, #b91c1c); color: var(--aeliqo-color-danger, #b91c1c); }
  `];
}
