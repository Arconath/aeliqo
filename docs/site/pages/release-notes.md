---
id: "release-notes"
path: "/ship/release-notes/"
section: "Ship"
title: "Aeliqo 0.4 release notes"
description: "The 0.4 release consolidates the public site, documents all components, and provides curated entry points across five packages."
---

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
