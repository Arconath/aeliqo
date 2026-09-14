# @aeliqo/web

The shared Lit implementation contains Aeliqo's 71 foundation, input, navigation,
feedback, data, plot, visualization, and semantic compound components. The root
entry exports the component families without defining custom elements. Call
`registerAeliqoElements()` once at the application boundary, or use the isolated
`@aeliqo/web/server` entry for the server renderer. The server entry accepts a
trusted, pre-resolved Lit template through `renderAeliqo`; it does not own
application data or routes.

The server entry is deliberately separate from the browser entry so a browser
bundle never pulls in Lit SSR or its DOM shim.

For a strict browser CSP, the host sets `globalThis.litNonce` before importing
the browser entry; Lit then applies that nonce to generated shadow-root styles.
The SSR renderer emits trusted static style tags without rewriting them, so a
server must include matching style hashes or its own nonce policy in the
response headers. The platform fixture exercises the browser nonce path and
blocks inline scripts; it is not a manual assistive-technology certification.


`@aeliqo/web/region` adds `createAeliqoPresentationRegistry` and
`AeliqoRegionElement`. The registry connects the pure presentation compiler to
the shared table, trend, filter, and stack implementations. The host supplies
`resolveEntity` for authorized result identities. No-preset composition uses the
same registry and validation as explicitly proposed plans.

Assign a validated presentation to the region's `presentation` property, exact
result-reference row sets to `results`, and committed interaction state to
`interaction`. Handle `onSemanticInteraction` by passing the typed request to the host's
interaction controller. The renderer does not authorize data access or execute
queries. When permission is revoked, clear the presentation and rows alongside
revoking runtime state. Registering Aeliqo elements also registers the region.

The region registry exposes the implemented component families to validated
presentation plans, including registered patterns, bounded no-preset composition,
and renderer-advertised state mappings. Server rendering accepts an unknown
environment; the application owns hydration wiring and must provide trusted
properties before resuming the deferred custom element.
