# Aeliqo owned design baseline

Status: T12 implementation reference for the 0.1.0 rewrite. The token source and CSS exports are testable inputs to visual review; they do not claim that a screenshot has been approved across browsers or operating systems.

## Source and scope

[`design/tokens.json`](../../design/tokens.json) is the canonical DTCG-compatible token document. It contains semantic light and dark roles, theme-specific visualization palettes, and shared type, spacing, control, focus, motion, elevation and locale values. `design/generate-web-tokens.mjs` generates the typed package map at [`packages/web/src/styles/tokens.ts`](../../packages/web/src/styles/tokens.ts). Run the generator after changing the JSON source and review the generated diff; CI can run `node design/generate-web-tokens.mjs --check` to fail on stale generated output.

The package baseline is opt-in and component scoped. A Lit element prepends `aeliqoThemeStyles` to its own `static styles` array. The exported stylesheet only targets `:host`, so importing it does not reset the consumer document or mutate `document.documentElement`. Applications that want one chosen container to own the variables can opt into `aeliqoStandaloneThemeStyles` with a `data-aeliqo-theme` attribute.

```ts
import {css, LitElement} from "lit";
import {aeliqoThemeStyles} from "@aeliqo/sdk-web/styles";

export class ExampleElement extends LitElement {
  static styles = [aeliqoThemeStyles, css`
    :host { display: block; }
  `];
}
```

The default mode follows the system color preference until a host reflects `data-aeliqo-theme="light"` or `data-aeliqo-theme="dark"`. Direct custom properties remain the final theming escape hatch. Components resolve their existing `--aeliqo-input-*`, `--aeliqo-table-*` and `--aeliqo-chart-*` properties before semantic tokens and their original fallbacks; the baseline deliberately does not define those legacy properties, so inherited and direct consumer overrides remain intact while new components use the owned token names.

Forced-colors maps roles to system colors such as `Canvas`, `CanvasText`, `ButtonText`, `Highlight` and `HighlightText`. Reduced motion sets the shared transition durations to `0ms`; components choose whether a transition is applicable. Direction uses CSS logical properties and can be reflected from `createAeliqoLocaleContext` with `aeliqoLocaleAttributes`. The helper canonicalizes and validates the BCP 47 tag with `Intl.Locale`. An explicit `direction` option always wins; otherwise the platform `Intl.Locale.prototype.getTextInfo()` result is required. Hosts running without that platform method must provide `direction` explicitly, rather than relying on a language list. Invalid tags are rejected:

```ts
const locale = createAeliqoLocaleContext("ar-EG", {direction: "rtl"});
// {lang: "ar-EG", dir: "rtl"}
```

The locale helper does not rewrite labels, infer a business calendar or mutate global locale state. It only provides immutable locale and direction metadata for the host/component boundary. Long labels and text scaling remain content and browser responsibilities and must be covered by visual and accessibility checks. Run `pnpm exec vitest run design/styles.test.ts` after changing tokens or locale behavior.

## Default visual language

The baseline uses neutral graphite surfaces, a restrained indigo accent, system sans-serif typography, a four-pixel-derived spacing rhythm, limited radii and a visible focus ring. Body text is `0.875rem` with a `1.5` line height; the default control target is `2.75rem`. Compact controls are an explicit density variant and must retain keyboard access and adequate spacing between targets. CSS uses logical block/inline properties so RTL does not require a second layout implementation.

The semantic roles are:

- `canvas` and `surface` for page/component backgrounds;
- `text`, `muted`, `border` and `focus` for readable hierarchy and interaction indication;
- `accent` and `onAccent` for the primary action;
- `success`, `warning`, `info` and `danger` for status communication;
- `visualization-series1` through `visualization-series4` and `visualization-reference` for data encodings.

Color is never the only signal for selection, validation or a chart series. The component must expose a text, shape, position, or accessible-name equivalent where the state applies. The existing reference contrast checks cover the primary text and action roles; rendered component review still verifies states, forced colors and real fonts.

## Named parts and default states

The typed `AELIQO_NAMED_PARTS` map is the initial public anatomy. Parts are stable styling hooks; internal wrappers without a listed part are implementation details.

| Element | Named parts | Default state expectations |
| --- | --- | --- |
| `aeliqo-input` | `field`, `label`, `input`, `description`, `error` | Label and help remain associated; focus is visible; required, read-only, disabled, pending and validation error states keep their positions; draft text is not silently discarded. |
| `aeliqo-table` | `scroll`, `table` | Header and cells preserve table semantics; empty content is explicit; essential comparison may scroll horizontally; keyboard focus reaches the scroll surface when needed. |
| `aeliqo-chart` | `figure`, `summary`, `unit`, `scope`, `plot`, `line`, `point`, `error`, `data` | Title, scope and unit remain available; exact values have a table path; empty, partial, invalid and loading states are explicit; selection is distinguishable without color alone. |

The applicable state vocabulary is `default`, `hover`, `focus-visible`, `pressed`, `selected`, `disabled`, `loading`, `empty`, `partial`, `stale`, `validation-error` and `error`. A component documents which states apply; decoration does not get invented loading states. A failure keeps the last authorized useful view when one exists and places actionable recovery text in a reachable status surface.

## Studio vocabulary

The Local Studio has four work areas, aligned with the Master SOT:

1. **Data & Meaning** — inspect authorized catalog metadata and author typed meanings. It shows scope, grain and validation; it does not grant authority or require a model.
2. **Experience** — choose approved profiles, token themes, density and bounded adaptations across sizes, direction and states.
3. **Component Gallery** — render actual owned components and their applicable states from the same package, with direct examples and documented parts.
4. **Inspect** — explain task, data, experience, lineage, candidates, rejected constraints, budgets and revisions. It is secondary UI and never displays private model chain-of-thought.

The old shorthand “Data, Meaning, Experience, Inspect” is retired because it hides the gallery as a separate review surface and splits the first area into two disconnected sources of truth. Code and Studio edit the same versioned documents; Studio proposals cannot silently overwrite code-owned definitions.

## Review matrix

The design baseline is reviewed at 320, 360, 768 and 1280 CSS pixels; light, dark, RTL, long labels, loading/empty/partial/stale/error, keyboard/IME/dirty draft, text scaling, forced colors and reduced motion are separate observations. Essential comparisons retain a task-equivalent surface even when narrow layouts need an explicit scroll region. A token file or generated CSS alone is not visual, accessibility, SSR, or browser-consumer evidence.
