# Aeliqo contributor guide

## Repository map

- `packages/core` owns schemas, contracts, query planning, and semantic validation. It is framework independent.
- `packages/runtime` owns data access, evaluation, regions, actions, results, and runtime state. It must not access the DOM.
- `packages/web` owns the shared Lit elements, renderers, and browser registration.
- `packages/react` provides React bindings over the web elements.
- `packages/agent` accepts bounded proposals through MCP, WebMCP, and model adapters. It must not grant permissions or produce executable UI.
- `apps/site` owns the public landing page, documentation shell, playground, local runner, static build, and production image. It consumes the packages; packages must not depend on the site.
- `catalog/components.json` defines the public component catalog. `examples/catalog` supplies runnable component examples.
- `docs/site/` is the authored public documentation source, including all 71 component pages and the other public routes.
- `docs/packages/` is the canonical source for the five npm package guides. Release staging copies these guides into each tarball as `README.md`.
- `tests` contains contract, clean tarball consumer, browser, accessibility, and performance checks.

The allowed dependency direction is `core → runtime → web → react`; `agent` may depend on `core` and `runtime`; `site` may consume all public packages. Do not add reverse dependencies or cycles. Keep I/O in adapters and keep composition roots limited to wiring.

## Trust and behavior

- Application code owns identity, data permissions, routes, actions, and business effects.
- Treat all agent input as untrusted. Validate it against registered resources, meanings, actions, and views before evaluation.
- Never render agent supplied HTML or execute agent supplied code.
- Preserve deterministic behavior and explicit failure states. Do not silently widen access or discard a valid previous result after a failed update.
- Keep core and runtime usable without a browser. Add browser APIs only in web or site adapters.

## Code changes

- Prefer small modules with one clear responsibility. Use guard clauses, discriminated unions, exhaustive switches, and pure functions for domain rules.
- Avoid nested conditionals, nested ternaries, catch-all managers/services, speculative abstraction, and duplicate sources of truth.
- Handwritten production functions should stay within 80 lines, files within 500 lines, cyclomatic complexity within 12, and nesting within 3. Generated code and fixtures are excluded by explicit path.
- No import cycles, unused production exports, unused dependencies, or unused locals/parameters. Do not add blanket lint waivers.
- Public API changes require package export-map updates, clean tarball consumer coverage, the matching `docs/packages/<package>.md` update, and a release note. A breaking change belongs in the 0.3 to 0.4 migration guide.
- Keep API and protocol version changes deliberate. Do not change serialized contracts as incidental cleanup.

## Component documentation

Write public documentation in English under `docs/site/`; do not place technical guides in package or application directories. Each catalog component has one authored file at `docs/site/components/<catalog-id>.md` and one runnable example. Explain the actual component behavior in plain language. Include purpose, when to use and avoid it, import, example, live preview, properties and defaults, events, states and failures, keyboard/focus/accessibility, responsive behavior, relevant performance limits, related components, and version notes. Generate API facts from declarations; do not invent defaults or emit generic filler such as “not declared.” Public page copy and navigation are authored in Markdown under `docs/site/pages/`.

Keep package guidance in `docs/packages/`. Release staging may generate the npm `README.md` files from those canonical documents. The root `README.md` is the repository overview and quickstart. Root Markdown is otherwise limited to `AGENTS.md` and required legal/community files.

## Generated files

- `design/generate-web-tokens.mjs` generates the web token output; edit its source tokens rather than generated CSS.
- `scripts/docs/build-public-docs.mjs` and `apps/site/generate-pages.mjs` produce public documentation and site artifacts. Edit canonical Markdown and generator code, not files under `artifacts/` or `dist/`.
- `packages/core/schemas` is generated from the core schema definitions during the core build.
- Do not commit local build output, caches, generated screenshots, or temporary consumer installations.

## Verification

- `quality/commands.json` is the complete acceptance matrix. Run `pnpm check` on a clean commit before release and read its fresh results.
- Core and runtime changes need their package build, contract or lifecycle tests, type checks, and matching clean tarball consumer.
- Web components need family behavior tests, browser tests, keyboard checks, and `pnpm test:components:a11y`. Changes to public exports also need the matching package consumer.
- React, Vue, and Vanilla integrations are covered by `pnpm test:framework:consumers`; Next SSR and hydration are covered by `pnpm test:next-platform`.
- Component docs and previews need `pnpm test:docs-artifact` and `pnpm test:catalog-examples`; the latter typechecks, builds, mounts, and compares every copyable example with its catalog preview. Site or playground changes need `pnpm site:build`, `pnpm site:test`, and the affected browser checks.
- Run `pnpm test:visual` in Chromium, Firefox, and WebKit. Capture the affected routes at 360, 768, and 1440 pixels, then check keyboard and accessibility behavior.
- Before release, run `pnpm test:performance:bundles`, clean tarball consumers, release tooling, docs verification, and the production image smoke checks for `/healthz`, `/readyz`, `/version`, and representative routes.

## Release and cutover

1. Complete review and all acceptance checks on `codex/aeliqo-0.4`; make one accepted source commit for the candidate.
2. Publish a release candidate from that commit with the `next` tag; reinstall and verify its five registry packages in a clean consumer.
3. Publish the matching stable `0.4.2` versions with the `latest` tag, tied to the exact verified candidate and source commit.
4. Build and deploy one immutable site image from the same commit. Switch production directly after the image passes health, route, search, playground, and package-install smoke checks.
5. Keep the prior site image available for rollback. Repair a published npm version with a patch release; do not unpublish it.
6. After the new site is stable, archive the old UI surfaces and publish the deprecation notice for `@aeliqo/devtools@0.3.0`. Keep old npm artifacts and Git tags available.

## Documentation and release policy

- Keep technical documentation under `docs/` and update it in the same change as behavior or API.
- Preserve historical ADRs as records; supersede decisions with a new ADR instead of rewriting history.
- The 0.4 release is breaking. The public product has five packages and one site application. Remove obsolete aliases and archive routes after their active consumers and tests have been migrated; keep older npm artifacts and Git tags available.
- Publish packages and deploy one immutable site image only from the same fully verified source revision. Cut over after all acceptance gates pass. Keep the prior production image available for rollback; repair an already published npm version with a patch release.
- Release staging generates each package README from `docs/packages/`. Do not maintain a second package guide in a package directory.

## Aeliqo vNext execution

For the vNext surface/API work, read `docs/plans/aeliqo-vnext/01-SPEC.md`, `02-EXECPLAN.md`, and `03-ACCEPTANCE.md`; contract detail is in `08-CONTRACTS.md`, corrections are in `09-AUDIT.md`, and `PLAN-INDEX.json` is the final-v3 task graph. Research facts and their limits are in `04-RESEARCH.md`. These are a living execution plan; keep `07-EXECUTION-STATE.md` and the task ledger current.

Keep feature definitions immutable and live surfaces scoped by explicit instance identity. Convenience and advanced paths must use the same runtime contracts. Preserve core/runtime/renderer/agent boundaries, existing authority/evaluation/action checks, no-AI operation, and real host state ownership. Do not implement a universal all-props component or a duplicate engine.

Use test-first changes, focused verification, complete component docs/examples, clean installed consumers, independent review, and unchanged-source release evidence. Maintain every requirement RQ01–RQ46 with an owning task and verification artifact. Source existence, declaration-only compilation, mock-model success, or a dispatched workflow is not runtime/release evidence.

Never overwrite others' work, weaken gates, invent supported frameworks/models/scale, leak secrets, or bypass authorization. Paid calls, merge, publication, and deployment retain their actual separate permission requirements.

Before handoff or context compaction, record exact source state, current task, failing command, decisions, and next action. Resume by reading the files and reconciling the worktree, not from conversational memory.

For scope work, a client workspace ID is a selector, not permission. Guard voluntary draft exits, fence forced revocation, keep immutable target epochs, and reject stale A-B-A work. Workspace layout adaptation stays in the same scope. The optional agent adapter targets an explicit scope/surface allowlist and must reset scoped conversation continuity. Old controllers never retarget a different tenant.
