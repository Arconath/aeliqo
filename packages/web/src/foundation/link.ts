import {css, html, nothing} from "lit";
import {AeliqoFoundationElement, aeliqoFoundationThemeStyles, safeResolvedHref} from "./base.js";
import {AeliqoLinkEvent} from "./events.js";

export type AeliqoLinkTarget = "_self" | "_blank";

/** Application-resolved link. It never interprets an arbitrary model URL as a destination. */
export class AeliqoLinkElement extends AeliqoFoundationElement {
  static readonly properties = {
    href: {type: String},
    target: {type: String},
    label: {type: String},
    disabled: {type: Boolean, reflect: true},
  };

  static readonly aeliqoVersion = "0.1.0-m0";

  href = "";
  target: AeliqoLinkTarget = "_self";
  label = "";
  disabled = false;

  protected override render() {
    const resolved = this.disabled ? undefined : safeResolvedHref(this.href);
    if (resolved === undefined) {
      return html`<span part="link" aria-disabled=${this.disabled ? "true" : nothing}><slot>${this.label}</slot></span>`;
    }
    const target = this.target === "_blank" ? "_blank" : "_self";
    return html`
      <a
        part="link"
        href=${resolved}
        target=${target}
        rel=${target === "_blank" ? "noopener noreferrer" : nothing}
        @click=${this.handleClick}
      ><slot>${this.label}</slot></a>
    `;
  }

  private readonly handleClick = (event: Event): void => {
    const accepted = this.dispatchEvent(new AeliqoLinkEvent({source: "user", target: this.target === "_blank" ? "_blank" : "_self"}));
    if (!accepted) event.preventDefault();
  };

  static readonly styles = [...aeliqoFoundationThemeStyles, css`
    :host {
      display: inline;
    }

    [part="link"] {
      color: var(--aeliqo-color-accent, #4338ca);
      overflow-wrap: anywhere;
      text-decoration-thickness: 0.1em;
      text-underline-offset: 0.15em;
    }

    a:hover {
      color: var(--aeliqo-color-info, #1d4ed8);
    }

    span[aria-disabled="true"] {
      color: var(--aeliqo-color-muted, #4b5563);
      cursor: not-allowed;
    }
  `];
}
