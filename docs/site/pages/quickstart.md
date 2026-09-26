---
id: 'quickstart'
path: '/start/'
section: 'Get started'
title: 'Quickstart: run an adaptive React view'
description: 'Run and test a local People surface in React without an account, model key, backend, or agent.'
---

<p class="lead">Render a real adaptive view in React with local data. No account, model key, backend, or agent needed.</p>

<aside class="doc-callout" data-tone="note"><strong>Before you start</strong><p>You need Node.js 24 and about ten minutes. Already have app data? Skip to the <a href="/start/registered-app/">registered app tutorial</a>.</p></aside>

<aeliqo-release-status></aeliqo-release-status>

## 1. Create a React app

```bash
npm create vite@latest people -- --template react-ts
cd people
```

This creates a `people` project and moves you into it.

## 2. Install Aeliqo

Keep every Aeliqo package on the same exact version:

```bash
npm install --save-exact @aeliqo/core@0.5.2 @aeliqo/runtime@0.5.2 @aeliqo/web@0.5.2 @aeliqo/react@0.5.2
```

You should see: all four packages at `0.5.2` in `package.json`.

## 3. Add some data

Create `src/people.ts`. Each row needs a unique `id`.

```ts
export type Person = { id: string; name: string; team: string };

export const people: Person[] = [
  { id: 'ada', name: 'Ada Chen', team: 'Design' },
  { id: 'sam', name: 'Sam Rivera', team: 'Engineering' },
  { id: 'jo', name: 'Jo Patel', team: 'Engineering' },
  { id: 'kim', name: 'Kim Osei', team: 'Product' },
  { id: 'max', name: 'Max Weber', team: 'Design' },
];
```

## 4. Render the surface

Replace everything in `src/main.tsx` with:

```tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { AdaptiveSurface, useDataSurface } from '@aeliqo/react/surface';
import { people } from './people';

function App() {
  const surface = useDataSurface({ data: people, getRowId: (row) => row.id });
  return (
    <main>
      <h1>People</h1>
      <AdaptiveSurface surface={surface} />
    </main>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
```

`useDataSurface` wraps your array in a read-only surface. `AdaptiveSurface` picks a view that fits the container.

You should see: no TypeScript errors in your editor.

## 5. Run it

```bash
npm run dev
```

Open the URL Vite prints (usually `http://localhost:5173`).

You should see: a table listing all five people.

## 6. Filter the data

Replace `src/main.tsx` again — the rows are now state, and two buttons change them:

```tsx
import { StrictMode, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { AdaptiveSurface, useDataSurface } from '@aeliqo/react/surface';
import { people } from './people';

function App() {
  const [rows, setRows] = useState(people);
  const surface = useDataSurface({ data: rows, getRowId: (row) => row.id });
  return (
    <main>
      <h1>People</h1>
      <button type="button" onClick={() => setRows(people.filter((p) => p.team === 'Engineering'))}>
        Engineering only
      </button>
      <button type="button" onClick={() => setRows(people)}>
        Everyone
      </button>
      <AdaptiveSurface surface={surface} />
    </main>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
```

Click **Engineering only**.

You should see: the table show two rows, then all five again on **Everyone**. React owns the rows; the surface follows your state.

## 7. Shrink the window

Drag the browser window narrow, or open your browser's device toolbar.

You should see: the table become cards. Same data, same selection — that swap is what "adaptive" means.

## What you just did

- Rendered a validated view from a plain array. You wrote no table markup.
- Filtered by replacing your own state. Aeliqo read the same array again.
- Got table-to-cards adaptation free, driven by container size.

To start empty or mutate rows in place, declare a schema and identity. See [local data](/guides/local-data/).

<nav class="doc-next" aria-label="Continue reading"><p>Next</p><a href="/start/registered-app/"><span>Connect your own data</span><small>Register real resources and read permissions from your app.</small><b aria-hidden="true">→</b></a><a href="/agents/quickstart/"><span>Add an agent</span><small>Let an agent send the same kind of request safely.</small><b aria-hidden="true">→</b></a><a href="/components/"><span>Browse components</span><small>See every registered view you can request.</small><b aria-hidden="true">→</b></a></nav>
