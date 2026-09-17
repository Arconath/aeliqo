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

## Styling and browser behavior

Components use the library's public design tokens and exposed shadow parts.
Applications can set those tokens on a host to match their own design system.
The public Aeliqo site uses one fixed visual theme; this does not remove host
customization from the component library.

The shared elements emit typed, cancelable interaction events where an action is
user initiated. Treat event detail as input and recheck application authority
before performing a business effect.
