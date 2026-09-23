---
id: 'migration-0-4'
path: '/ship/migration-0.4/'
section: 'Ship'
title: 'Migrate from 0.4.2 to vNext 0.5'
description: 'Move from live Aeliqo 0.4.2 to the breaking 0.5.0 source candidate after its release gates.'
---

## Release line and compatibility

Aeliqo `0.4.2` remains the live, stable release. The vNext work is prepared as
a breaking `0.5.0` source candidate because it adds public surface and scoped
runtime contracts. `0.5.0-rc.1` exists on npm's `next` tag from an earlier
source revision; it does not contain every change on this page. Nothing here
changes the published `0.4.2` packages. Use the newer candidate only after
its own release gates and publication are approved.

The wire contract remains version `1`. The existing application/resource/Region
path is the compatibility adapter for applications that are not ready to move.
Do not install a mixture of `0.4.2` and `0.5.0` packages in one application;
keep all Aeliqo packages on one exact release line.

## Move feature definitions to the new entry

The old resource path remains valid. New code can describe immutable data or
non-data features through the dedicated feature entry:

```ts
// Existing 0.4.2 path
import { defineResource } from '@aeliqo/core';

// vNext 0.5.0 path
import { defineDataFeature, defineFeature } from '@aeliqo/core/features';
```

Data features lower through the existing resource, query, and authority
contracts. Non-data features describe typed capabilities and intents without
inventing rows or a second evaluator. Keep live rows, principals, credentials,
and host permissions outside the immutable definition.

## Add explicit surface ownership

Create each live surface through `@aeliqo/runtime/surfaces` and keep its scope,
identity, and data binding explicit. Scope transition contracts are available
from `@aeliqo/runtime/scopes` as types for the host-owned lifecycle adapter:

```ts
import { createAeliqoRuntime } from '@aeliqo/runtime';
import { createLocalDataBinding } from '@aeliqo/runtime/surfaces';

const runtime = createAeliqoRuntime({ resources, authority });
const binding = createLocalDataBinding({
  feature: peopleFeature,
  snapshot,
  initialState: { rows: [], selection: [] },
  coverage,
  normalize,
});
const surface = runtime.createSurface({
  scope,
  id: 'people-main',
  feature: peopleFeature,
  bindings: binding,
});
```

Surface construction is inert. Requests, scope attachment, disposal, and host
proposal acceptance are explicit. A workspace or client ID selects a scope; it
does not grant permission. Preserve host-owned authority and business effects.

React applications may adopt the native/headless binding from
`@aeliqo/react/surface`. It consumes a real application-owned controller and
does not create a second data or authorization engine. Existing React provider
and Region imports remain the compatibility path.

## Keep agent integration optional

The no-agent entries (`@aeliqo/core`, `@aeliqo/runtime`, `@aeliqo/web`, and
`@aeliqo/react`) do not import model transports, provider SDKs, or server-only
helpers. Add the scoped browser bridge only when the host explicitly enables
it:

```ts
import { connectAgent } from '@aeliqo/agent/browser';

const connection = connectAgent({ scope, client, targets: ['people-main'] });
```

The target list is an allowlist, not a permission grant. Rebind and reset the
connection when scope or target identity changes. Keep credentials in the host
model port; never put them in prompts or tool arguments.

## Migration checks

Build a clean consumer from packed artifacts and run the T20 qualification
fixture before requesting a release candidate. It checks the old 0.4 root
imports, every new feature/surface/browser entry, export targets, legal files,
optional peers, and the browser no-agent module graph. See the
[qualified support matrix](/ship/support-matrix/) for the tested framework,
browser, provider, and workload profiles. Unsupported or untested entries are
labelled there rather than inferred from a passing protocol test.
