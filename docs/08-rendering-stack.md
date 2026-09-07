# 08 — Platform implementation and stack

## Selected architecture

Use strict TypeScript for semantic/query/presentation passes and runtime coordination. Use **Lit 3 native custom elements** for one shared web component implementation. Native HTML controls handle form semantics; CSS handles normal layout; modular D3 supplies 2D scales/geometry. Publish a thin React binding and prove direct HTML/vanilla usage. A Vue consumer is an interoperability smoke test, not a second component library.

This is a selected implementation strategy with an early mandatory production spike, not a promise that choosing Lit automatically produces accessible SSR or pixel-perfect output. Lit documents its React integration and SSR constraints. React 19 also has improved custom element support, but complex properties and SSR still require tested integration. [S08, S09, S10]

## Why not a renderer per framework?

Separate React/Vue/Svelte catalogs multiply visual bugs, state behavior and accessibility work. A headless semantic core alone does not prevent that duplication. One web implementation plus thin host bindings does. The semantic RenderPlan/RendererPort remains platform-neutral, but every real new platform still needs an implementation and its own conformance matrix.

Do not promise “render everywhere with zero adapters.” v0.1.0 supports the web platform; the core is usable in JS runtimes without the DOM. Native mobile/desktop are future platform realizations, not fake compatibility badges.

## Web component boundaries

Prefer components at meaningful control/view boundaries, not one custom element per cell, label or plot mark. A table's native `table/tr/td` hierarchy belongs inside one compatible root; do not scatter semantic table elements across unrelated shadow roots. Keep form labels, descriptions and their inputs in a tested ownership boundary. Use open shadow roots and explicit form association where needed, with browser/manual accessibility evidence.

Expose CSS custom properties and documented parts for bounded theming. Do not leak a global reset or style the host application's root. Keep overlays in an explicit, tested overlay manager with focus return, modality, inertness, escape behavior and stacking tokens. Test ARIA references across any portal/shadow boundary actually used. There is no blanket assumption that ID references cross roots.

Avoid automatic global registration on importing the pure package. Explicit element registration is idempotent, detects incompatible duplicate versions and has a side-effect-specific entry point. Namespaced tags and instance IDs prevent collisions across multiple apps.

## React binding

The binding maps typed props to element properties, DOM events to typed callbacks, lifecycle to mount/dispose, and refs to a documented imperative handle. Controlled values remain controlled: prop updates are reflected; user events are proposals, not silently committed model state. No second planner, formatter, keyboard engine, state cache or component template lives in the React package.

Provide small direct imports. Importing a Button/Metric must not drag in Region, planner, agent SDK, charts or Studio. React strict-mode remount behavior and callback identity changes are tested.

## SSR and hydration

Use resolved data and a deterministic server plan; no browser measurement or model invocation during SSR. The Lit SSR integration is isolated behind the web/server entry. Its documented limitations include async component work and supported component styles, so pre-resolve asynchronous inputs and test the exact supported release matrix rather than generalizing. [S10]

M0 must prove: static native content is present, declarative shadow content hydrates without mismatch/duplication, no secrets enter HTML, controlled form values survive, unknown initial container width does not cause disruptive layout shift, and focus/draft survives initialization. A server import of core or React bindings cannot throw because `window` is absent.

If the production spike exposes an unresolved SSR/accessibility blocker, stop catalog-wide implementation and record an ADR with measured alternatives. Preserve one shared behavior/model implementation. Do not quietly ship a browser-only shell as SSR support. The selected platform is not dogma; the acceptance contract is.

## Toolchain

Node 24 LTS is the default build/server target; Node 22 remains a compatibility candidate where required. Node's official release table is the source of support status. [S11] Use pnpm workspaces, stable TypeScript, Vite for fixtures/playground tooling, Vitest for tests, Playwright for browser/visual checks, fast-check for properties, ESLint/TypeScript rules and a formatter. Use Astro for the public docs/content site and its interactive web-component regions; the runtime is not an Astro or Next.js plugin.

Pin exact resolved versions and integrity in M0 after checking official releases/security and consumer compatibility. This kit deliberately does not invent a lockfile or claim current npm dependency versions were installed: direct registry access failed in the preparation environment. No `latest` floating versions in CI/release.

Prefer one runtime schema implementation internally with generated TypeScript/JSON Schema. Accept Standard Schema validators at the authoring boundary without proliferating Zod/Yup/Valibot adapters. Validation does not imply introspectable metadata; require an explicit converter/manifest where unavailable. [S05]

## 2D and performance ownership

Use modular D3, not the entire umbrella package. Keep data preparation/aggregation in core or executor; geometry is a pure calculation with an isolated dependency. The web renderer owns DOM and layout. Never let D3 mutate DOM that Lit also owns. Use SVG for accessible moderate-density charts; Canvas for proven large-mark cases only. A Web Worker is an optimization behind ports, not a baseline requirement for simple components.

No Rust/WASM/Arrow/distributed scheduler in the initial critical path. Introduce them only when a real profiled bottleneck beats the complexity cost and a portable fallback exists.

## Pixel quality means a tested matrix

Typography rasterization differs by OS/browser. Promise adherence to the approved design and controlled per-environment baselines, not identical pixels everywhere. Pin browser build, OS/container image, fonts, locale, color scheme, DPR, viewport and motion state for golden tests. Playwright explicitly warns about cross-environment screenshot variability. [S12]

## Master consolidation platform acceptance before catalog-wide investment

The platform spike is a real input + table + plot, exercised through vanilla, React and SSR. It must measure cold transfer/parse/init, output HTML, hydration, controlled values/events, IME, native form association/reset/autofill, focus/labels, shadow/overlay semantics and style isolation. A native custom element is not a browser-security sandbox or an accessibility certification.

Unknown server container measurements are a tagged state. Never insert a fake desktop width to satisfy a numeric type. The server produces a deterministic approved initial presentation; the client measures and performs a state-preserving refinement. Critical tasks should remain usable through the documented baseline if hydration fails.

Selection of Lit is still conditional on this production gate. Do not assume its experimental SSR package is stable by implication. Do not add custom elements per table cell/plot point. Prefer native semantic subtrees under meaningful view/control boundaries. Renderer agnosticism means replaceable semantic/platform contracts; it does not mean universal native platform support.

The current validation environment could not download Lit from npm (DNS EAI_AGAIN). That is an environment limitation, not proof Lit or npm is down. This revision has no new Lit/browser/pixel evidence; the named early gate remains required.
