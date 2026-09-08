import {css, html} from "lit";
import {AeliqoFoundationElement, aeliqoFoundationThemeStyles} from "./base.js";

export type AeliqoTextAs = "span" | "p" | "div" | "small" | "strong" | "em" | "label";

/** Plain text primitive. Text is interpolated as text, never as HTML. */
export class AeliqoTextElement extends AeliqoFoundationElement {
  static readonly properties = {
    text: {type: String},
    as: {type: String},
    muted: {type: Boolean, reflect: true},
  };

  static readonly aeliqoVersion = "0.1.0";

  text = "";
  as: AeliqoTextAs = "span";
  muted = false;

  protected override render() {
    const content = html`<slot>${this.text}</slot>`;
    switch (this.as) {
      case "p": return html`<p part="text" class=${this.muted ? "muted" : ""}>${content}</p>`;
      case "div": return html`<div part="text" class=${this.muted ? "muted" : ""}>${content}</div>`;
      case "small": return html`<small part="text" class=${this.muted ? "muted" : ""}>${content}</small>`;
      case "strong": return html`<strong part="text" class=${this.muted ? "muted" : ""}>${content}</strong>`;
      case "em": return html`<em part="text" class=${this.muted ? "muted" : ""}>${content}</em>`;
      case "label": return html`<label part="text" class=${this.muted ? "muted" : ""}>${content}</label>`;
      default: return html`<span part="text" class=${this.muted ? "muted" : ""}>${content}</span>`;
    }
  }

  static readonly styles = [...aeliqoFoundationThemeStyles, css`
    :host { display: inline; max-inline-size: 100%; }
    [part="text"] { overflow-wrap: anywhere; white-space: normal; }
    .muted { color: var(--aeliqo-color-muted, #4b5563); }
  `];
}
