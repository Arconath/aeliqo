# `@aeliqo/web`

`@aeliqo/web` contains the shared Lit implementation, custom elements, browser
registration, adaptive recipes, and the browser application facade.

## Component entry point

```ts
import { registerAeliqoElements } from '@aeliqo/web';
import { createAeliqoPresentationRegistry } from '@aeliqo/web/region';

registerAeliqoElements();
const registry = createAeliqoPresentationRegistry();
```

The package root and component subpaths can be used without the runtime
package. Import the application facade separately when an application needs
the default runtime and adaptive recipes:

```ts
import { createAeliqoApp } from '@aeliqo/web/app';

const app = createAeliqoApp({ resources, authority });
```

`createAeliqoApp` composes the runtime with registered renderers and standard
recipes. It does not create authority or infer application permissions. The
`@aeliqo/web/app` subpath requires the matching `@aeliqo/runtime` package.
Registration is explicit so server module evaluation does not touch
`customElements`.

## Adaptive recipe policy

The application facade derives a presentation policy from each mounted
resource's `presentation.allowedViews`. Standard recipes author deterministic
canonical candidates and configurations; the shared core resolver performs the
single eligibility and ranking decision before any runtime or renderer commit.
The same validation applies to custom recipe candidates. For example, a
resource that allows only `table` stays in `data.table` even when a narrow
container would otherwise make cards more suitable.

Direct recipe consumers can pass the optional policy explicitly:

```ts
import type { RecipeContext, RecipePresentationPolicy } from '@aeliqo/web';

const presentationPolicy: RecipePresentationPolicy = {
  allowedRepresentations: ['data.table'],
};

const context: RecipeContext = {
  intent,
  task,
  result,
  current,
  environment,
  availableViews,
  presentationPolicy,
};
```

`allowedRepresentations` contains canonical renderer IDs such as `data.table`,
not resource aliases such as `table`. `RecipePresentationPolicy` is also
available from `@aeliqo/web/recipes`. The property is optional for direct recipe
consumers; `createAeliqoApp` always supplies it for data tasks.

When the preferred representation is a trend, the standard recipe binds only
requested result fields. It prefers a field with the semantic `time` role and
requires exactly one requested numeric `measure`. Multiple eligible time or
measure fields return a `web.recipe.needs-input.*` diagnostic so the application
can ask for a choice instead of plotting an arbitrary numeric field.

Analyze requests can also select the registered `bar` representation when a
categorical dimension and one numeric measure are available. Compare requests
with two identities use the bounded split-pane composition when the container is
wide enough; each child detail is pinned to one requested identity from the same
authorized result. Narrow layouts retain the simultaneous table comparison. The
split is not an implicit permission grant: the resource's allowed views, renderer
registry, operation and result bindings must all permit it.

An explicit view pin is a hard gate and never falls through to another recipe
candidate. A preferred view remains a ranking input and may fall back only to a
fully eligible candidate. Direct `RecipeDefinition.build` calls remain a
source-compatible candidate-authoring API; they are not a commit decision.

## Component entry points

Import an individual element or family from its subpath. For example:

```ts
import { AeliqoButtonElement } from '@aeliqo/web/button';
import { AeliqoTextFieldElement } from '@aeliqo/web/text-field';
import { AeliqoBarElement, AeliqoTrendElement } from '@aeliqo/web/visualization/cartesian';
```

Family exports include `foundation`, `inputs`, `navigation`, `feedback`, `data`,
`plot`, `visualization`, and `compound`. Region registration and low-level
rendering live under `@aeliqo/web/region`; server rendering lives under
`@aeliqo/web/server`. Utility subpaths cover `@aeliqo/web/register`
(`registerAeliqoElements`, `AELIQO_WEB_VERSION`), `@aeliqo/web/events` (typed
selection events), `@aeliqo/web/styles` (theme styles and locale context),
`@aeliqo/web/table` and `@aeliqo/web/chart` (element classes and stable row
keys), `@aeliqo/web/region/adaptation` (region adaptation internals), and the
`@aeliqo/web/foundation/manifest` and `@aeliqo/web/inputs/manifest` family
manifests.

`<aeliqo-chart>` is the low-level series chart. It renders a responsive SVG
with labeled axes and grid lines, plus a collapsible table with the exact
values. Set `points` for one series or `series` for multiple series.
The chart uses English labels by default. Set `lang="id"` or an Indonesian locale
such as `lang="id-ID"` for Indonesian chart controls and accessible labels;
region trend charts use the validated presentation locale automatically.
Application titles, series labels, and scope names remain host-authored.
The scope annotation remains visible in either language. The catalog
visualizations such as `<aeliqo-trend>` provide semantic views for
registered resources and meanings.

## Styling and browser behavior

Components use the library's public design tokens and exposed shadow parts.
Applications can set those tokens on a host to match their own design system.
The public Aeliqo site and the component package are generated from the same
token source. The site follows the system color scheme by default and offers
persistent light and dark choices. Applications can keep that behavior or set
the public tokens on a host for their own theme.

The shared elements emit typed, cancelable interaction events where an action is
user initiated. Treat event detail as input and recheck application authority
before performing a business effect.
