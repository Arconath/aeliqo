# @aeliqo/react

Thin React 19 bindings for the shared `@aeliqo/web` elements. Call
`registerAeliqoReactElements()` at the application boundary, then use
`AeliqoInput`, `AeliqoTable`, and `AeliqoChart`. Properties remain controlled by
React; input edits are delivered through the typed `onAeliqoInput` callback.
