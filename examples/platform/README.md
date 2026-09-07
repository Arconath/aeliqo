# T02 platform fixture

Run the fixture from the repository root with the pinned Vite binary:

```sh
./node_modules/.bin/vite examples/platform --host 127.0.0.1 --port 4173
```

The three pages exercise the same registered web elements from vanilla HTML,
React 19, and Vue 3. The browser tests cover controlled input proposals,
rejected edits, native form reset/submission, focus, Shadow DOM style
isolation, CSP script blocking, accessible table/chart markup, and Lit
declarative-shadow-root hydration.

The fixture uses Lit's `globalThis.litNonce` hook before importing the elements
and a nonce-based style policy. Server-rendered static styles need matching
response-header hashes or a host-provided nonce policy, as described in the
web package README. Next.js has no dedicated fixture here; the browser-free
server import and generic `renderAeliqo` API are the reusable boundary to wire
into a Next server entry, but that integration remains an explicit follow-up
gate.
