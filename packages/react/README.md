# @aeliqo/react

Thin React 19 bindings for the shared `@aeliqo/web` elements. Call
`registerAeliqoReactElements()` at the application boundary, then use
`AeliqoInput`, `AeliqoTable`, and `AeliqoChart`. Properties remain controlled by
React; input edits are delivered through the typed `onAeliqoInput` callback.

### Server rendering

Import `@aeliqo/react/ssr` before React and Aeliqo bindings at both the server and hydration entry points. This opt-in entry enables Lit's React SSR integration and registers the shared elements; it renders their content as declarative Shadow DOM. Plain React rendering without this entry emits element shells. Ordinary component imports do not enable the integration.

```ts
import '@aeliqo/react/ssr';
import {AeliqoTextField} from '@aeliqo/react/inputs';
```

The integration follows [Lit SSR React](https://github.com/lit/lit/tree/main/packages/labs/ssr-react). Host frameworks must preserve the declarative Shadow DOM and load hydration support before element definitions. Framework-specific hydration is verified separately from Node server rendering.
