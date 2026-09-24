---
id: 'quickstart'
path: '/start/'
section: 'Start'
title: 'Tutorial: build an adaptive React app'
description: 'Copy a complete no-AI React starter, then add registered People data, a semantic trend, a form, and an optional agent.'
---

<p class="lead">Start with a local React surface that needs no model, provider, catalog, or grant setup. Then extend the same idea to registered resources, a semantic trend, a host-owned form, and an optional MCP endpoint.</p>

<div class="docs-inline-cta"><p><strong>Result:</strong> the starter filters local People data without a model; the registered tutorial below adds a semantic workforce trend.</p><a href="/playground/?scenario=people">Try the finished journey →</a></div>

<aside class="doc-callout" data-tone="note"><strong>Prerequisites</strong><p>Use Node.js 24, React 19.2, TypeScript, and one React root. Keep every Aeliqo package on the same exact version. The expanded tutorial sources below are compiled by this repository.</p></aside>

<aeliqo-release-status></aeliqo-release-status>

This tutorial targets the breaking `0.5.0` line. Keep all installed Aeliqo
packages on exactly the same version.

## Start here: a complete local React app without AI

Create an empty directory with these four files. With the matching `0.5.0`
packages available in the registry, run `npm install`, `npm run typecheck`, and
`npm run dev`. The historical `0.5.0-rc.1` predates this local-surface API;
it cannot run this example. The example uses application-owned rows and makes
no model or remote data request.

**package.json**

```json
{
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@aeliqo/core": "0.5.0",
    "@aeliqo/runtime": "0.5.0",
    "@aeliqo/web": "0.5.0",
    "@aeliqo/react": "0.5.0",
    "react": "19.2.8",
    "react-dom": "19.2.8"
  },
  "devDependencies": {
    "@types/react": "19.2.18",
    "@types/react-dom": "19.2.7",
    "typescript": "7.0.2",
    "vite": "8.2.2"
  }
}
```

**tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "jsx": "react-jsx",
    "strict": true,
    "noEmit": true,
    "skipLibCheck": true,
    "lib": ["ES2022", "DOM"]
  },
  "include": ["src"]
}
```

**index.html**

```html
<!doctype html>
<html lang="en">
  <head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /><title>People</title></head>
  <body><div id="root"></div><script type="module" src="/src/main.tsx"></script></body>
</html>
```

**src/main.tsx**

```tsx
import { StrictMode, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { AdaptiveSurface, useDataSurface } from '@aeliqo/react/surface';

type Person = { id: string; name: string; team: string };
const initial: Person[] = [
  { id: 'ada', name: 'Ada Chen', team: 'Design' },
  { id: 'sam', name: 'Sam Rivera', team: 'Engineering' },
];

function People() {
  const [rows, setRows] = useState(initial);
  const surface = useDataSurface({ data: rows, getRowId: row => row.id });

  return <main>
    <h1>People</h1>
    <button type="button" onClick={() => setRows(
      current => current.filter(person => person.team === 'Engineering')
    )}>Show Engineering</button>
    <button type="button" onClick={() => setRows(initial)}>Show everyone</button>
    <AdaptiveSurface surface={surface} />
  </main>;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode><People /></StrictMode>
);
```

Filtering creates a new array; restoring the initial rows replaces that filtered
array. The hook updates the same local controller after React commits; the view
can adapt to its container. The local scope is read-only and gives no access to
a server. For an initially empty array, declare a schema and `identity`; for an
in-place mutation, supply a changed `version`. See
[local data](/guides/local-data/) for those rules.

## Continue: registered resources and an optional agent

The larger People tutorial below adds semantic validation, forms, and an MCP
endpoint. It uses the compatibility `@aeliqo/react/app` API for its registered
Region. Choose this path when application data and authority live outside the
local array.

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
