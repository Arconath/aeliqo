import {css, unsafeCSS} from "lit";
import type {CSSResult} from "lit";
import {
  AELIQO_DARK_TOKENS,
  AELIQO_LIGHT_TOKENS,
  AELIQO_SHARED_TOKENS,
} from "./tokens.js";

const declarations = (values: Readonly<Record<string, string>>): string =>
  Object.entries(values).map(([name, value]) => `${name}: ${value};`).join("\n");

const baseDeclarations = `${declarations(AELIQO_LIGHT_TOKENS)}\n${declarations(AELIQO_SHARED_TOKENS)}`;
const darkDeclarations = `${declarations(AELIQO_DARK_TOKENS)}\n${declarations(AELIQO_SHARED_TOKENS)}`;

const forcedColorDeclarations = `
  --aeliqo-color-canvas: Canvas;
  --aeliqo-color-surface: Canvas;
  --aeliqo-color-text: CanvasText;
  --aeliqo-color-muted: GrayText;
  --aeliqo-color-border: ButtonText;
  --aeliqo-color-accent: Highlight;
  --aeliqo-color-on-accent: HighlightText;
  --aeliqo-color-danger: LinkText;
  --aeliqo-color-success: Highlight;
  --aeliqo-color-warning: Highlight;
  --aeliqo-color-info: Highlight;
  --aeliqo-color-focus: Highlight;
  --aeliqo-chart-line: Highlight;
  --aeliqo-chart-point: Canvas;
`;

const inheritedThemeDeclarations = Object.keys({...AELIQO_LIGHT_TOKENS, ...AELIQO_SHARED_TOKENS})
  .map((name) => `${name}: unset;`)
  .join("\n");

const sharedRules = `
  color: var(--aeliqo-color-text);
  background-color: var(--aeliqo-color-canvas);
  direction: inherit;
  font-family: var(--aeliqo-typography-font-family-system);
  font-size: var(--aeliqo-typography-font-size-body);
  font-weight: var(--aeliqo-typography-font-weight-regular);
  line-height: var(--aeliqo-typography-line-height-normal);
  text-rendering: optimizeLegibility;
`;

/**
 * Component-scoped baseline styles. Add this result before component-specific
 * styles in a Lit `static styles` array; it never selects document or host-app
 * elements outside the component root.
 */
export const aeliqoThemeStyles: CSSResult = css`
  :host {
    ${unsafeCSS(baseDeclarations)}
    ${unsafeCSS(sharedRules)}
    color-scheme: light;
    box-sizing: border-box;
  }

  :host([data-aeliqo-theme="dark"]) {
    ${unsafeCSS(darkDeclarations)}
    color-scheme: dark;
  }

  /* Opt into a theme supplied by an ancestor scope using inherited variables. */
  :host([data-aeliqo-theme="inherit"]) {
    ${unsafeCSS(inheritedThemeDeclarations)}
    color-scheme: inherit;
  }

  @media (prefers-color-scheme: dark) {
    :host(:not([data-aeliqo-theme="light"]):not([data-aeliqo-theme="dark"]):not([data-aeliqo-theme="inherit"])) {
      ${unsafeCSS(darkDeclarations)}
      color-scheme: dark;
    }
  }

  :host([dir="rtl"]) {
    direction: rtl;
  }

  :host([dir="ltr"]) {
    direction: ltr;
  }

  :host([data-aeliqo-text-scale="large"]) {
    font-size: 1.125rem;
  }

  :host([data-aeliqo-density="compact"]) {
    --aeliqo-control-min-target: var(--aeliqo-control-compact-target);
  }

  @media (prefers-reduced-motion: reduce) {
    :host {
      --aeliqo-motion-duration-fast: 0ms;
      --aeliqo-motion-duration-standard: 0ms;
    }
  }

  @media (forced-colors: active) {
    :host {
      ${unsafeCSS(forcedColorDeclarations)}
      forced-color-adjust: auto;
    }
  }
`;

/**
 * Explicit opt-in stylesheet for a chosen application scope. Apply it to a
 * container carrying `data-aeliqo-theme`; importing this module has no global
 * side effect and does not mutate `document.documentElement`.
 */
export const aeliqoStandaloneThemeStyles: CSSResult = css`
  :where([data-aeliqo-theme]) {
    ${unsafeCSS(baseDeclarations)}
    ${unsafeCSS(sharedRules)}
    color-scheme: light;
  }

  :where([data-aeliqo-theme="dark"]) {
    ${unsafeCSS(darkDeclarations)}
    color-scheme: dark;
  }

  @media (prefers-color-scheme: dark) {
    :where([data-aeliqo-theme]:not([data-aeliqo-theme="light"]):not([data-aeliqo-theme="dark"])) {
      ${unsafeCSS(darkDeclarations)}
      color-scheme: dark;
    }
  }

  :where([data-aeliqo-theme][dir="rtl"]),
  :where([data-aeliqo-theme] [dir="rtl"]) {
    direction: rtl;
  }

  :where([data-aeliqo-theme][dir="ltr"]),
  :where([data-aeliqo-theme] [dir="ltr"]) {
    direction: ltr;
  }

  @media (prefers-reduced-motion: reduce) {
    :where([data-aeliqo-theme]) {
      --aeliqo-motion-duration-fast: 0ms;
      --aeliqo-motion-duration-standard: 0ms;
    }
  }

  @media (forced-colors: active) {
    :where([data-aeliqo-theme]) {
      ${unsafeCSS(forcedColorDeclarations)}
      forced-color-adjust: auto;
    }
  }
`;

export const aeliqoThemeStyleText = aeliqoThemeStyles.cssText;
