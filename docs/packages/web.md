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
resource's `presentation.allowedViews`. Standard recipes choose only canonical
representations permitted by that policy, and final plan validation applies the
same restriction to custom recipes. For example, a resource that allows only
`table` stays in `data.table` even when a narrow container would normally favor
cards.

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
`@aeliqo/web/server`.

`<aeliqo-chart>` is the low-level series chart. It renders a responsive SVG
with labeled axes and grid lines, plus a collapsible table with the exact
values. Set `points` for one series or `series` for multiple series. The
catalog visualizations such as `<aeliqo-trend>` provide semantic views for
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
