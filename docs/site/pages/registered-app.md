---
id: 'registered-app'
path: '/start/registered-app/'
section: 'Get started'
title: 'Tutorial: integrate a registered People app'
description: 'Connect application-owned data and authority, then render a filtered table, semantic trend, reviewed form, and optional MCP tools.'
---

<p class="lead">Connect your own data and permissions to Aeliqo. You will render a filtered table, a trend chart, and a reviewed form in one region. The last step exposes the same surface to an agent over MCP.</p>

<div class="docs-inline-cta"><p><strong>New to Aeliqo?</strong> Run the small local quickstart first. Come back when you need real app data.</p><a href="/start/">Open the local React quickstart →</a></div>

<aside class="doc-callout" data-tone="note"><strong>Before you start</strong><p>You need Node.js 24, React 19.2, TypeScript, and an app that can provide rows plus the signed-in user's permissions. Keep every Aeliqo package on exactly version 0.5.2.</p></aside>

<aeliqo-release-status></aeliqo-release-status>

This tutorial uses the app-level API in `@aeliqo/react/app`. You mount a named region once, then send typed requests to it. The code below is the real, compiled tutorial source.

## 1. Install the packages

```bash
npm install --save-exact \
  @aeliqo/core@0.5.2 \
  @aeliqo/runtime@0.5.2 \
  @aeliqo/web@0.5.2 \
  @aeliqo/react@0.5.2 \
  @aeliqo/agent@0.5.2 \
  react@19.2.8 react-dom@19.2.8 zod@4.5.4
```

## 2. Register resources and data

Create `src/app.ts`. It defines two resources. `people` has a stable `id`, labeled fields, and two allowed views. `workforce-headcount` stores one month-end snapshot per month; its measure is marked semi-additive so it is never summed across months.

The same file creates two bounded local data services and an `authorize` check that reads the signed-in user. `createAeliqoApp` wires resources, data, and authority into one app instance. Swap the local service for your HTTP adapter when your server owns the records — keep credentials and grants out of requests.

<aeliqo-source data-label="src/app.ts" data-path="examples/quickstart/src/app.ts"></aeliqo-source>

You should see: `createTutorialApp(records)` returns one app instance with two registered resources.

## 3. Mount a region in React

Create `src/PeopleTutorial.tsx`. `AeliqoProvider` shares the app instance. `AeliqoRegion` mounts the `people-main` region and renders the current `intent` prop. `onReceipt` reports each result status. The buttons are plain React — no model call happens.

## 4. Filter with a typed request

The **Engineering** button sends a `browse` request with a `compare` filter on `team`. Aeliqo validates the field and value against the `people` resource before reading data. The table and its visible filter come from one result — you never filter the DOM yourself.

## 5. Chart a measure

The **Monthly headcount** button sends an `analyze` request for the `month-end-headcount` measure. It declares the month field, Gregorian calendar, monthly grain, and UTC timezone. The trend view binds those declared roles — it does not guess the first numeric column.

## 6. Add a reviewed form

The form uses the React wrappers `AeliqoForm`, `AeliqoTextField`, and `AeliqoSelect`. Field changes are proposals; React state stays in charge. Submit only writes a review message — a production app would pass the draft to a registered action with fresh authorization.

<aeliqo-source data-label="src/PeopleTutorial.tsx" data-path="examples/quickstart/src/PeopleTutorial.tsx"></aeliqo-source>

Mount the screen in your entry file, then dispose the app when the screen is removed for good:

```tsx
import { createRoot } from 'react-dom/client';
import { createTutorialApp } from './app.js';
import { PeopleTutorial } from './PeopleTutorial.js';

const app = createTutorialApp([
  { id: 'ada', name: 'Ada Chen', team: 'Design' },
  { id: 'sam', name: 'Sam Rivera', team: 'Engineering' },
]);

createRoot(document.querySelector('#root')!).render(<PeopleTutorial app={app} />);
```

You should see: three buttons drive the region — a table of people, a filtered table, and a headcount trend — plus a review-only form.

## 7. Expose the region to an agent

Create `src/agent.ts`. `createAppToolEndpoint` pairs one mounted region with a transport and gives the agent three tools: `aeliqo_context`, `aeliqo_render`, `aeliqo_act`. The host picks the region, transport, expiry, and size limits. The agent cannot grant itself permissions or supply markup.

<aeliqo-source data-label="src/agent.ts" data-path="examples/quickstart/src/agent.ts"></aeliqo-source>

Attach the endpoint to the [local MCP transport](/agents/mcp/) and close it on disconnect or expiry. Keep every button and form working when no agent is connected.

## Check your work

<div class="doc-checklist"><ul><li>All employees renders a table on wide containers and an allowed compact view on narrow ones.</li><li>Engineering shows only the Engineering rows you passed in, with the filter visible.</li><li>Monthly headcount plots 118 through 130 by month and never sums them.</li><li>The form keeps its draft and writes nothing before host review.</li><li>The MCP endpoint expires, disconnects, and rechecks permissions on every tool call.</li><li>Unmounting the screen disposes the region; disposing the app cancels remaining work.</li></ul></div>

## Read the result status

<div class="doc-table"><table><thead><tr><th>Status</th><th>Next action</th></tr></thead><tbody><tr><th><code>needs-input</code></th><td>Show the returned choice or form field and send a more specific request.</td></tr><tr><th><code>unsupported</code></th><td>Check the resource's requests, registered views, and presentation policy.</td></tr><tr><th><code>denied</code></th><td>Fix host authorization. Never put a grant inside the request.</td></tr><tr><th><code>failed</code></th><td>Show the diagnostic and keep the previous valid view.</td></tr><tr><th><code>cancelled</code></th><td>Treat unmount and superseded requests as normal. Retry only on a new user action.</td></tr></tbody></table></div>

<nav class="doc-next" aria-label="Continue reading"><p>Continue reading</p><a href="/guides/resources/"><span>Resource guide</span><small>Review identity, meaning, forms, and presentation policy.</small><b aria-hidden="true">→</b></a><a href="/agents/quickstart/"><span>Agent quickstart</span><small>Pair one expiring session with your region.</small><b aria-hidden="true">→</b></a></nav>
