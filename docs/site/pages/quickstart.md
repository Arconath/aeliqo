---
id: 'quickstart'
path: '/start/'
section: 'Start'
title: 'Tutorial: build an adaptive React app'
description: 'Install Aeliqo, define People data, render a table, filter it, show a semantic headcount trend, add a form, and expose the same Region to a user-owned agent.'
---

<p class="lead">Build one React and TypeScript screen that works through ordinary controls first. You will add a registered table, a team filter, a month-end headcount chart, a host-owned form, and an optional MCP endpoint. Every path uses the same application authority and validated Region.</p>

<div class="docs-inline-cta"><p><strong>Result:</strong> the People screen switches among employee data and a semantic workforce trend without generated HTML or a model dependency.</p><a href="/playground/?scenario=people">Try the finished journey →</a></div>

<aside class="doc-callout" data-tone="note"><strong>Prerequisites</strong><p>Use Node.js 24, React 19.2, TypeScript, and a client entry with one React root. Keep every Aeliqo package on the same exact version. The complete sources below are compiled by this repository.</p></aside>

<aside class="doc-callout" data-tone="warning"><strong>Release line</strong><p>This tutorial targets the breaking <code>0.5.0</code> release line. It becomes installable when the approved release workflow publishes that version. Until then, keep existing applications on the published <code>0.4.2</code> line and do not mix package versions.</p></aside>

## 1. Install the packages

Install the contract, runtime, renderer, React bindings, optional agent endpoint,
and Zod together:

```sh
npm install --save-exact \
  @aeliqo/core@0.5.0 \
  @aeliqo/runtime@0.5.0 \
  @aeliqo/web@0.5.0 \
  @aeliqo/react@0.5.0 \
  @aeliqo/agent@0.5.0 \
  react@19.2.8 react-dom@19.2.8 zod@4.5.4
```

## 2. Define resources and trusted data

The application defines two resources. `people` provides stable identities and
the fields used by table and filter intents. `workforce-headcount` records one
month-end snapshot per month. Its meaning is semi-additive, so values may be
compared across time and must never be summed across months.

The same file connects bounded local records and reads authority from trusted
application state. Replace the local adapter with an HTTP adapter when your
server owns the records; do not move credentials or grants into an intent.

<aeliqo-source data-label="src/app.ts" data-path="examples/quickstart/src/app.ts"></aeliqo-source>

## 3. Render a table from React

`AeliqoProvider` shares the application instance. `AeliqoRegion` owns mount,
render cancellation, subscription, and unmount for the React lifecycle. The
first structured browse intent requests Name and Team and prefers the registered
table representation.

The controls remain ordinary React buttons. No model call is required.

## 4. Apply an explicit filter

The Engineering button sends a typed equality predicate. Aeliqo validates the
field and closed value against the resource before evaluation. The result and
its visible filter remain aligned because the application replaces them from one
receipt rather than filtering rendered DOM.

## 5. Show a semantic trend

The Monthly headcount button switches the Region to the snapshot resource. The
intent requests the registered `month-end-headcount` meaning and declares the
month field, Gregorian calendar, monthly grain, and UTC timezone. The chart
recipe binds those requested roles; it does not choose the first numeric column.

## 6. Add a host-owned form

The form uses React wrappers for Aeliqo controls. Change events are proposals;
React state remains authoritative. Submit creates a review message and prevents
the native effect. A production app would pass the reviewed draft through a
registered action with current authorization and revision evidence.

<aeliqo-source data-label="src/PeopleTutorial.tsx" data-path="examples/quickstart/src/PeopleTutorial.tsx"></aeliqo-source>

Mount the screen with one application instance and dispose it when the React
root is permanently removed:

```tsx
import {createRoot} from 'react-dom/client';
import {createTutorialApp} from './app.js';
import {PeopleTutorial} from './PeopleTutorial.js';

const app = createTutorialApp([
  {id: 'ada', name: 'Ada Chen', team: 'Design'},
  {id: 'sam', name: 'Sam Rivera', team: 'Engineering'},
]);

createRoot(document.querySelector('#root')!).render(<PeopleTutorial app={app} />);
```

## 7. Connect a user-owned agent

Create the endpoint only after the Region is mounted. The host chooses the
Region, transport, goal epoch, expiry, and resource discovery. The endpoint
exposes `aeliqo_context`, `aeliqo_render`, and `aeliqo_act`; renderer success is
reported only after the real Region accepts the presentation. The model cannot
grant itself permissions or supply executable UI.

<aeliqo-source data-label="src/agent.ts" data-path="examples/quickstart/src/agent.ts"></aeliqo-source>

Attach the returned endpoint to the [local MCP transport](/agents/mcp/), then
close it on disconnect or expiry. Keep all buttons, filters, and forms available
when no agent is connected.

## Verify the tutorial

<div class="doc-checklist"><ul><li>All employees renders a table in a wide Region and an allowed compact view only when the resource permits it.</li><li>Engineering shows only the synthetic Engineering records and keeps the filter visible.</li><li>Monthly headcount labels the metric definition and plots 118 through 130 by month without summing them.</li><li>The form preserves its controlled draft and performs no write before host review.</li><li>The MCP endpoint expires, disconnects, and rechecks current authority for every tool call.</li><li>Removing the React screen unmounts the Region; disposing the application cancels remaining work.</li></ul></div>

## Recover from failures

<div class="doc-table"><table><thead><tr><th>Outcome</th><th>Next action</th></tr></thead><tbody><tr><th><code>needs-input</code></th><td>Show the returned metric, identity, or form choice and resubmit a more specific intent.</td></tr><tr><th><code>unsupported</code></th><td>Check resource intents, registered views, and the effective presentation policy.</td></tr><tr><th><code>denied</code></th><td>Fix host authorization. Never add a grant to the intent payload.</td></tr><tr><th><code>failed</code></th><td>Show the bounded diagnostic and keep the previous valid result available.</td></tr><tr><th><code>cancelled</code></th><td>Treat supersession and unmount as expected; retry only from a new user request.</td></tr></tbody></table></div>

<nav class="doc-next" aria-label="Continue reading"><p>Continue reading</p><a href="/guides/resources/"><span>Resource guide</span><small>Model identity, business meaning, forms, and presentation policy.</small><b aria-hidden="true">→</b></a><a href="/start/frameworks/"><span>Framework setup</span><small>Keep the Vanilla, Vue, SSR, and hydration paths correct.</small><b aria-hidden="true">→</b></a></nav>
