---
id: 'release-notes'
path: '/ship/release-notes/'
section: 'Ship'
title: 'Release notes'
description: 'Published 0.4.2 changes and the separately identified, unpublished 0.5 source candidate.'
---

## vNext source candidate (0.5.0)

The live stable line remains `0.4.2`. The vNext candidate is a breaking
successor and has not reached stable publication or site deployment.
`0.5.0-rc.1` is on npm's `next` tag for all five packages, but it was published
from an earlier source revision that lacks the local React path described below.
Do not use that RC as evidence for this newer candidate.

The items in this section describe the current repository source. For an
installed 0.4.2 release, use the compatibility app/Region path described in
the [React tutorial](/start/). The providerless local surface
and scoped APIs below require a later matching 0.5 package build. Follow the
[0.4.2 to 0.5 migration guide](/ship/migration-0.4/) for adoption boundaries.

- `@aeliqo/core/features` introduces immutable data and non-data feature
  definitions. Data features lower through the existing resource/catalog path;
  non-data features declare versioned intents, views, and bounded capability
  schemas without fabricating relational data.
- `@aeliqo/runtime` adds unreleased scoped surface controllers with immutable
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
  gates. This newer source candidate has not been published or deployed, and production
  runtime remains unverified.
- The unreleased runtime candidate now exposes one canonical
  `createLocalDataBinding` adapter under `@aeliqo/runtime/surfaces`. It lowers
  through the existing `LocalDataService`, ResultStore, and Region paths,
  validates bounded local shape and identity diagnostics, preserves controller
  addresses across explicit source revisions, and rejects same-revision or
  catalog conflicts atomically. This newer source candidate remains unpublished and
  undeployed.
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
  protocol fixtures remain synthetic; this candidate is still unpublished and
  undeployed.
- Semantic aggregate plans now retain and revalidate their registered meaning
  binding. Semi-additive period-end selection is deterministic, ratios and
  variadic means keep their registered behavior, and nested/count aggregates
  apply the meaning's missing-value policy instead of silently weakening it.
- `@aeliqo/core` now provides bounded `inferLocalDataShape` diagnostics for
  declared or structurally inferred scalar fields; it does not infer authority,
  coverage, relationships, or business identity. The two helpers remain part
  of the unpublished vNext candidate.
- `@aeliqo/core/presentation` now exposes the pure `resolvePresentation`
  decision facade. It returns a validated `ready` plan, structured
  `needs-input` choices, or bounded `unsupported` reasons from supplied
  evidence only; target evidence is not authority, explicit view pins do not
  silently fall back, and preferred pins only influence deterministic ranking.

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
- The site uses one fixed visual style. Component consumers can still supply
  their own design tokens.
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
