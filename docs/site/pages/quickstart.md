---
id: 'quickstart'
path: '/start/'
section: 'Start'
title: 'Quickstart: run an adaptive React view'
description: 'Run and test a local People surface in React without an account, model key, backend, or agent.'
---

<p class="lead">Render and filter a small People list in React. This first path uses local sample data and no model, account, backend, or agent.</p>

<div class="docs-inline-cta"><p><strong>Test now, without setup.</strong> In the playground, try <em>People in Jakarta</em>, <em>Daily attendance</em>, then <em>Analytical workspace</em>. Check the committed filter and period, inspect the rendered result, and open <em>Inspect</em> to see the validated intent and diagnostics. These journeys use synthetic data and make zero model calls.</p><a href="/playground/">Try the playground →</a></div>

<h2>Choose the path you need</h2>
<div class="decision-grid"><article><h3>Start here · local React</h3><p>Use the short tutorial below to render and filter a local array. No provider key or authority setup.</p><a href="#create-the-project">Build the first view →</a></article><article><h3>Already have app data?</h3><p>Use the separate integration tutorial for registered resources, server-owned authority, semantic analysis, forms, and optional MCP.</p><a href="/start/registered-app/">Build a registered app →</a></article></div>

<aside class="doc-callout" data-tone="note"><strong>Prerequisites</strong><p>Use Node.js 24, React 19.2, and TypeScript. Keep every Aeliqo package on the same exact version. The example source is compiled and exercised by the repository checks.</p></aside>

<aeliqo-release-status></aeliqo-release-status>

This tutorial targets the stable `0.5.2` release. Keep installed Aeliqo
packages on exactly the same version.

<span id="create-the-project"></span>

## 1. Create the project files

Create an empty directory and add these four files. This example uses your
application-owned rows and makes no model or remote data request.

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
    "@aeliqo/core": "0.5.2",
    "@aeliqo/runtime": "0.5.2",
    "@aeliqo/web": "0.5.2",
    "@aeliqo/react": "0.5.2",
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
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>People</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
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
  const surface = useDataSurface({ data: rows, getRowId: (row) => row.id });

  return (
    <main>
      <h1>People</h1>
      <button
        type="button"
        onClick={() => setRows((current) => current.filter((person) => person.team === 'Engineering'))}
      >
        Show Engineering
      </button>
      <button type="button" onClick={() => setRows(initial)}>
        Show everyone
      </button>
      <AdaptiveSurface surface={surface} />
    </main>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <People />
  </StrictMode>,
);
```

## 2. Install and run

```sh
npm install
npm run typecheck
npm run dev
```

Open the local URL printed by Vite. Click **Show Engineering** to filter the
People list, then **Show everyone** to restore it. Resize the page to see the
view adapt to its container.

## What this example demonstrates

`useDataSurface` creates a local, read-only surface from rows with stable IDs.
React owns the rows; changing the array updates the same surface. `AdaptiveSurface`
chooses an eligible registered view for the available space. No server data,
model, or remote permission is involved. For an initially empty array, declare
a schema and `identity`; for in-place mutation, supply a changed `version`. See
[local data](/guides/local-data/) for those rules.

## Continue when you need app-owned data

For authenticated data, resource meanings, a host-owned form, or an optional
MCP endpoint, follow the [registered app tutorial](/start/registered-app/).

<nav class="doc-next" aria-label="Continue reading"><p>Continue reading</p><a href="/playground/"><span>Try the playground</span><small>Test guided no-AI scenarios in your browser.</small><b aria-hidden="true">→</b></a><a href="/start/registered-app/"><span>Registered app tutorial</span><small>Connect your own data and authority.</small><b aria-hidden="true">→</b></a></nav>
