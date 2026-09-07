# @aeliqo/web

The T02 platform slice contains the shared Lit implementation for Aeliqo's
native input, semantic table, and accessible SVG chart. Importing this entry
does not define custom elements. Call `registerAeliqoElements()` once at the
application boundary, or use the isolated `@aeliqo/web/server` entry for the
server renderer. The server entry accepts a trusted, pre-resolved Lit template
through `renderAeliqo`; it does not own application data or routes.

The server entry is deliberately separate from the browser entry so a browser
bundle never pulls in Lit SSR or its DOM shim.

For a strict browser CSP, the host sets `globalThis.litNonce` before importing
the browser entry; Lit then applies that nonce to generated shadow-root styles.
The SSR renderer emits trusted static style tags without rewriting them, so a
server must include matching style hashes or its own nonce policy in the
response headers. The platform fixture exercises the browser nonce path and
blocks inline scripts; it is not a manual assistive-technology certification.
