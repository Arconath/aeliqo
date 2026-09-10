# @aeliqo/sdk-react

Thin React 19 bindings for the shared `@aeliqo/sdk-web` elements. The package
exports wrappers for all 71 catalog components from the root entry and from
the `foundation`, `inputs`, `navigation`, `feedback`, `data`, `plot`,
`visualization`, and `compound` family entries. Call
`registerAeliqoReactElements()` at the browser application boundary. Properties
remain controlled by React and custom-element events are exposed as typed
callback props. `AeliqoInput` and `AeliqoChart` remain small compatibility
entries for the original platform fixture.

### Server rendering

Import `@aeliqo/sdk-react/ssr` before React and Aeliqo bindings at both the server and hydration entry points. This opt-in entry enables Lit's React SSR integration and registers the shared elements; it renders their content as declarative Shadow DOM. Plain React rendering without this entry emits element shells. Ordinary component imports do not enable the integration.

```ts
import '@aeliqo/sdk-react/ssr';
import {AeliqoTextField} from '@aeliqo/sdk-react/inputs';
```

The integration follows [Lit SSR React](https://github.com/lit/lit/tree/main/packages/labs/ssr-react). Host frameworks must preserve the declarative Shadow DOM and load hydration support before element definitions. Framework-specific hydration is verified separately from Node server rendering.
