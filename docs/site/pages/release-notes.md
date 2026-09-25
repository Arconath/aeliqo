---
id: 'release-notes'
path: '/ship/release-notes/'
section: 'Ship'
title: 'Release notes'
description: 'Aeliqo 0.5 changes, migration boundaries, and the prior 0.4.2 release.'
---

## Aeliqo 0.5.1

This patch release keeps the 0.5 API and runtime contract intact while shipping
the clearer local React quickstart, the registered People app tutorial, the
public 0.5 playground journeys, and a polished documentation shell. Install all
five packages at exactly `0.5.1` when using this release.

## Aeliqo 0.5.0

All five `0.5.0-rc.2` packages and matching stable `0.5.0` packages were
published from accepted source `4e8b0395b92eee699da4e25c3cd4991bc50b4a5e`
after the [Quality run](https://github.com/Arconath/aeliqo/actions/runs/35974446712),
[RC publication run](https://github.com/Arconath/aeliqo/actions/runs/35985377354),
and [stable publication run](https://github.com/Arconath/aeliqo/actions/runs/35988121627)
succeeded. The [site image run](https://github.com/Arconath/aeliqo/actions/runs/35988444181)
also succeeded. At image publication, production cutover and public live checks
had not yet been verified.
Production was subsequently accepted at 2026-09-24 11:17 UTC in the
[platform deployment evidence](https://github.com/Arconath/platform-apps/commit/1ffebc47de046c17f1d8b9fba4b059a5cf8fe94a).
The apex, www, and docs sites reported 0.5.0 at that source revision; the
[stable GitHub release](https://github.com/Arconath/aeliqo/releases/tag/v0.5.0)
was published after live verification.
The [platform cutover receipt](https://github.com/Arconath/workspace/blob/c35cb83c60e276a21f7500fa39a497db17e000a6/docs/platform/cutover.json)
records reviewed promotion gates, Flux and pod readback, and a qualified route
back to the retained 0.4.2 image. No production rollback was executed.

This is a breaking successor to `0.4.2`. The historical `0.5.0-rc.1` was
published from an earlier source revision that lacks the local React path
described below. Do not use that RC as evidence for this source.

DeepSeek `deepseek-flash` passed the bounded 12-case synthetic J1–J3 live
browser/provider/renderer corpus on tree-equivalent PR head `21afcca` (tree
`955a7d1`); the [sanitized 12-case receipt](https://github.com/Arconath/aeliqo/blob/main/docs/plans/aeliqo-vnext/evidence/deepseek-flash-j1-j3-21afcca.json)
records each result. This is model- and corpus-specific evidence; it does not qualify
other hosted models or production workloads.

The [public 0.5.0 browser receipt](https://github.com/Arconath/aeliqo/blob/main/docs/plans/aeliqo-vnext/evidence/public-acceptance-4e8b039.json)
records docs navigation/search, the no-AI People Jakarta, Daily attendance,
and Analytical workspace journeys, and a downloadable ZIP. The separate
[clean consumer receipt](https://github.com/Arconath/aeliqo/blob/main/docs/plans/aeliqo-vnext/evidence/live-export-consumer-4e8b039.json)
records installation of the exact 0.5.0 packages from npm, a successful build,
and browser rendering of the ZIP's synthetic products.

The items in this section describe the 0.5.0 source. For an existing
0.4.2 integration, use the compatibility app/Region path described in
the [React tutorial](/start/). The providerless local surface
and scoped APIs below require matching 0.5 packages. Follow the
[0.4.2 to 0.5 migration guide](/ship/migration-0.4/) for adoption boundaries.

The agent context can expose host-registered custom intents, presentation
patterns, and time-window constraints for a paired Region. The host remains
the authority for compilation, query bounds, and rendering.

- `@aeliqo/core/features` introduces immutable data and non-data feature
  definitions. Data features lower through the existing resource/catalog path;
  non-data features declare versioned intents, views, and bounded capability
  schemas without fabricating relational data.
- `@aeliqo/runtime` adds scoped surface controllers with immutable
  instance addresses, per-runtime reference-counted registration, internal and
  explicitly controlled host ownership, and real `DataService`/Region/Result
  integration. Capability bindings carry an address-independent typed initial
  intent, and permission changes fence pending host proposals. The new
  host-resolved scope controller adds inert attachment, guarded Save/Discard/Stay
  workspace transitions, forced revocation, monotonic activation epochs, and
  child-surface fencing without treating a client workspace ID as authority.
  Its required synchronous, side-effect-free preparation hook atomically
  revalidates captured old-scope and target authority before fencing; a
  separate commit hook starts target effects only after the old activation is
  fenced.
  Existing app/Region APIs remain the compatibility path.
- Local implementation and acceptance evidence cover runtime, React, migration,
  compatibility, browser, documentation, performance, and packed-consumer
  gates. Production workload behavior needs separate environment evidence.
- The runtime now exposes one canonical
  `createLocalDataBinding` adapter under `@aeliqo/runtime/surfaces`. It lowers
  through the existing `LocalDataService`, ResultStore, and Region paths,
  validates bounded local shape and identity diagnostics, preserves controller
  addresses across explicit source revisions, and rejects same-revision or
  catalog conflicts atomically.
- The local React path can now use `useDataSurface({ data, getRowId })` with an
  owned providerless local controller. Its runtime source can accept an
  opt-in monotonic revision sequence for long-lived updates while rejecting
  stale or changed-content replay; identical current-revision content remains
  a no-op. The default arbitrary-revision cap is unchanged. Native React
  adaptive selection requires trusted presentation evidence and uses the
  shared resolver; standalone view registration alone is not automatic
  eligibility.
- Native React registrations now accept a trusted `load` function for a
  route-split view. The adapter retains an authorized previous view during
  loading and failure, exposes retry, and clears old content on target loss.
- The optional model adapter restricts unauthenticated profiles to explicitly
  allowlisted loopback origins. Remote hosted connections require a
  server-owned credential profile.
- The trusted local Playground runner rejects cross-site browser requests to
  session bootstrap, including requests that omit `Origin`. The public
  attendance and workspace journeys show a readable status while retaining
  machine receipts in Inspect.
- Remote data now uses the same validated `DataService`, ResultStore, and
  Region path as local data. Catalog capabilities declare metrics and stable
  snapshot or keyset pagination; cursors are partitioned by authority and pin
  target, query, ordering, semantic revisions, consistency, and expiry.
  Expiry uses a wall clock while request work retains a separate monotonic
  budget clock. Local continuation metadata is kept in a bounded host registry;
  an accepted continuation plan pins its validated offset so registry eviction
  cannot restart the query from the first page.
  Partial pages preserve unknown or estimated population metadata, and only a
  server-proven aggregate may claim complete global coverage. The localhost
  protocol fixtures remain synthetic and do not prove a production backend.
- Semantic aggregate plans now retain and revalidate their registered meaning
  binding. Semi-additive period-end selection is deterministic, ratios and
  variadic means keep their registered behavior, and nested/count aggregates
  apply the meaning's missing-value policy instead of silently weakening it.
- `@aeliqo/core` now provides bounded `inferLocalDataShape` diagnostics for
  declared or structurally inferred scalar fields; it does not infer authority,
  coverage, relationships, or business identity. The two helpers remain part
  of the 0.5 source.
- `@aeliqo/core/presentation` now exposes the pure `resolvePresentation`
  decision facade. It returns a validated `ready` plan, structured
  `needs-input` choices, or bounded `unsupported` reasons from supplied
  evidence only; target evidence is not authority, explicit view pins do not
  silently fall back, and preferred pins only influence deterministic ranking.
- The advanced React path accepts `useSurface(feature, { id, bindings })`
  under the nearest `AeliqoProvider` and active `AeliqoScope`. Controller
  creation and the first request occur after React commit. `AeliqoScope`
  gates children by the committed activation; a voluntary Save / Discard /
  Stay transition keeps the old authorized subtree mounted while access
  remains valid. Accepted A→B→A activations create new controllers, and old
  callbacks retain their old address. Initial, denied, invalidated, and
  disposed scopes show safe states. The factory and providerless local paths
  remain available.
- Registered presentation patterns can be discovered from the active
  experience without an application-supplied placeholder plan. The synthetic
  attendance workspace uses this path for its summary, daily trend, and
  employee breakdown. The attendance example derives its civil-day query
  bounds from the period shown to the user and explicitly rejects unsupported
  timezone projections.
- The paired agent context can expose host-registered custom intent schemas
  and presentation pattern references for a routable resource. The live
  attendance workspace publishes these refs from the compiler and pattern
  used by its render path.
- The public playground adds People Jakarta, Daily attendance, and Analytical
  workspace journeys alongside People, Products, Support, and Knowledge.
  Manual operation remains available without a model. Model prompts use a
  configured same-origin local runner; the site no longer accepts a provider
  key in the browser or sends browser requests directly to the provider.
  Exported 0.5 source projects are enabled only in a site image whose
  matching packages passed an exact-version registry install and build check.
- Region trend charts pass the validated presentation locale to their chart.
  The low-level chart uses Indonesian controls, scope text, and accessible
  labels when its host sets `lang="id"` or `lang="id-ID"`; application titles
  and series names remain host-owned.

## 0.4.2

- Adaptive data recipes now obey each resource's allowed views during selection
  and final plan validation.
- Preferred trends bind requested semantic time and measure fields. Ambiguous
  time or measure choices return a needs-input diagnostic.
- `RecipePresentationPolicy` is exported from `@aeliqo/web` and
  `@aeliqo/web/recipes` for direct recipe integrations.
- Trend charts measure their container instead of stretching fixed SVG
  geometry, including narrow labels and constant-value series.
- The People playground now proves employee browse, team filtering, detail,
  and semantic monthly headcount through the same Without AI and connected
  agent paths.
- The site and components share one generated token source with system, light,
  and dark themes. Theme choice persists without changing application data.
- The React-first tutorial now covers a complete table, filter, semantic chart,
  controlled form, and bounded agent endpoint. Component reference pages add
  property ownership, event payloads and timing, listener examples, states,
  accessibility, responsive behavior, and performance limits.
- DeepSeek BYOK distinguishes configured, connecting, verified, failed, and
  disconnected states. Simulated and native WebMCP evidence are reported
  separately, with an opt-in native lifecycle probe.

## Product

- Landing page, documentation, component reference, and playground run from the
  single `apps/site` application.
- The site shares one token system across light, dark, and system modes.
  Component consumers can still supply their own design tokens.
- Every catalog component has an authored reference page and runnable preview.

## Packages

The public workspace contains `@aeliqo/core`, `@aeliqo/runtime`,
`@aeliqo/web`, `@aeliqo/react`, and `@aeliqo/agent`. Root imports cover common
flows; specialized APIs use explicit subpaths. See [packages and entry
points](/reference/packages/) for the supported map.

The core root includes typed parsers for queries, interactions, presentation
plans, and result events. Use these when the contract kind is known; use
`parseContract` for dynamically selected kinds.

## Breaking changes

The 0.4 release removes the Studio app and `@aeliqo/devtools`, narrows package
root exports, and removes legacy input names and MCP request forms. A
`taskId` is required for task-scoped data requests. The web application facade
is imported from `@aeliqo/web/app`; the package root remains usable without the
optional runtime peer. `@aeliqo/react` declares `@aeliqo/runtime` as a required
peer for its app and region state API. Follow the
[0.3 to 0.4 migration guide](/ship/migration-0.3/) when upgrading an existing
integration.

## Runtime contract

The serialized wire version remains `1`. Manual code and connected agents use
the same validated intent path, while application code retains authority over
identity, data access, actions, and business effects.
