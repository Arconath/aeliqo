---
id: 'quickstart'
path: '/start/'
section: 'Get started'
title: 'Quickstart: run an adaptive React view'
description: 'Build a React People view that filters local rows and adapts to its container.'
---

<p class="lead">Turn five local records into a working People view. Add a filter button, then resize its container to see the presentation adapt.</p>

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
npm install --save-exact @aeliqo/core@0.6.0 @aeliqo/runtime@0.6.0 @aeliqo/web@0.6.0 @aeliqo/react@0.6.0
```

You should see: all four packages at `0.6.0` in `package.json`.

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

## 4. Style your page

Create `src/people.css`. The local surface renders native React markup, so
your application supplies its typography and colors. These styles give the
example a readable table, compact cards, and keyboard-visible filter controls.
They follow your system's light or dark appearance.

<details>
<summary>Copy the page styles</summary>

```css
:root {
  color-scheme: light dark;
  font:
    100% / 1.5 system-ui,
    sans-serif;
  color: CanvasText;
  background: Canvas;
}
body {
  margin: 0;
}
main {
  max-width: 60rem;
  margin: auto;
  padding: clamp(1rem, 4vw, 3rem);
}
h1 {
  margin-bottom: 0;
}
.filters {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-block: 1.5rem;
}
.filters button {
  min-width: 44px;
  min-height: 44px;
  padding: 0.625rem 1rem;
  border: 1px solid ButtonText;
  border-radius: 0.5rem;
  font: inherit;
  cursor: pointer;
}
.filters button[aria-pressed='true'] {
  color: HighlightText;
  background: Highlight;
}
.filters button:focus-visible {
  outline: 3px solid Highlight;
  outline-offset: 3px;
}
.people-surface table {
  width: 100%;
  border-collapse: collapse;
}
.people-surface th,
.people-surface td {
  padding: 0.875rem;
  text-align: start;
  border-bottom: 1px solid GrayText;
}
.people-surface dl {
  display: grid;
  grid-template-columns: max-content minmax(0, 1fr);
  column-gap: 1rem;
}
.people-surface dd {
  overflow-wrap: anywhere;
}
```

</details>

## 5. Render the surface

Replace `src/main.tsx` once with this complete entry file. It includes the
filter controls used in the next step:

```tsx
import { StrictMode, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { AdaptiveSurface, useDataSurface } from '@aeliqo/react/surface';
import { people } from './people';
import './people.css';

function App() {
  const [rows, setRows] = useState(people);
  const surface = useDataSurface({ data: rows, getRowId: (row) => row.id });
  return (
    <main>
      <h1>People</h1>
      <p>Browse the team, or focus on Engineering.</p>
      <div className="filters" role="group" aria-label="Filter people">
        <button
          type="button"
          aria-pressed={rows !== people}
          onClick={() => setRows(people.filter((p) => p.team === 'Engineering'))}
        >
          Engineering only
        </button>
        <button type="button" aria-pressed={rows === people} onClick={() => setRows(people)}>
          Everyone
        </button>
      </div>
      <section className="people-surface" aria-label="People results">
        <AdaptiveSurface surface={surface} />
      </section>
    </main>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
```

`useDataSurface` reads the rows owned by React. `getRowId` preserves each
person's identity when the array changes. `AdaptiveSurface` renders those rows
using a view that fits its container. The two buttons are ordinary React state
updates; they do not contact a server.

## 6. Run and try the view

```bash
npm run dev
```

Open the URL printed by Vite. At a wide container size, you should see five
people in a table. Click **Engineering only**: Sam and Jo remain. Click
**Everyone**: all five return.

The selected filter has a highlighted background. Use **Tab** to move between the
buttons: a visible outline follows keyboard focus, and **Enter** applies the
filter. The buttons wrap onto separate lines when space is limited.

Narrow the browser window until the container is compact. The same rows render
as cards. Widen it again to return to the table. Adaptation follows the space
available to the surface, including when it sits inside a larger page.

## If the result differs

- **A blank page:** inspect the browser console and Vite terminal. Confirm the
  HTML contains `<div id="root"></div>` and the script loads `src/main.tsx`.
- **An import fails:** check that the four Aeliqo packages use the exact same
  version and that installation completed. The release note above identifies
  whether the displayed version is published.
- **The rows do not change:** copy the complete entry file once. Pass `rows`
  into `useDataSurface`, not the original `people` array.
- **The view stays a table:** reduce the surface's container width. Changing
  data or calling a model is unnecessary.
- **The page looks unstyled:** confirm `src/people.css` exists and that the
  entry imports it. You can replace these sample styles with your app's theme.

## What to add next

This read-only surface is enough when React already owns a small local array.
Start with an explicit schema if the initial array is empty; see
[local data](/guides/local-data/). For server data, permissions, and named
regions, continue with [Connect your data](/start/registered-app/).

Then [compose a workspace or registered page](/guides/workspace/): combine
multiple results and add application-owned header and sidebar views.

The [framework guide](/start/frameworks/) covers Vanilla and Vue. For Next.js,
follow [SSR and hydration](/ship/ssr/) before importing browser modules.

<nav class="doc-next" aria-label="Continue reading"><p>Next</p><a href="/start/registered-app/"><span>Connect your data</span><small>Register resources and application authority.</small><b aria-hidden="true">→</b></a><a href="/agents/quickstart/"><span>Add an agent</span><small>Expose an already working surface to bounded requests.</small><b aria-hidden="true">→</b></a></nav>
