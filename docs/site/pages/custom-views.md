---
id: 'custom-views'
path: '/guides/custom-views/'
section: 'Build'
title: 'Custom views'
description: 'Register a trusted application renderer with an exact presentation manifest and lifecycle.'
---

<p class="lead">A custom view is trusted application code. An agent may request a registered view, but cannot install one, supply its import path, or render its own HTML.</p>

## Define a view

This article renderer uses the same `defineView` contract as the [Knowledge example](/examples/knowledge/). Its top-level reference and manifest reference must match. The manifest declares the result and operation it can use; `render` receives an authorized result and returns a Lit template.

```ts
import { defineView } from '@aeliqo/web/recipes';
import { html } from 'lit';

export const knowledgeArticleView = defineView({
  ref: { id: 'demo.knowledge-article', revision: '1' },
  manifest: {
    ref: { id: 'demo.knowledge-article', revision: '1' },
    configSchema: { id: 'demo.knowledge-article.config', revision: '1' },
    roles: ['article'],
    operations: [{ id: 'data.read', revision: '1' }],
    result: 'required',
    children: { min: 0, max: 0 },
    visibility: 'leaf',
    extension: true,
    resolveConfig: (values) => ({
      ok: true,
      value: {
        values,
        fields: ['title', 'topic', 'excerpt', 'content'],
        ports: [],
        operations: [{ id: 'data.read', revision: '1' }],
      },
    }),
  },
  render: ({ result }) => {
    const article = result?.rows[0];
    if (article === undefined) return html`<p>No article was found.</p>`;
    return html`<article>
      <p>${String(article.topic)}</p>
      <h2>${String(article.title)}</h2>
      <p>${String(article.excerpt)}</p>
      <p>${String(article.content)}</p>
    </article>`;
  },
});
```

This is a complete view definition, not a complete application: the host still
provides the resource, data service, authority, intent, and Region. Install
`lit` alongside the matching Aeliqo packages when copying the file. Register
`knowledgeArticleView` in the `views` option of the application composition
root alongside its app-owned resources and authority. The maintained source is
`apps/site/src/playground/scenario-view.ts`; its registration is in
`apps/site/src/playground/session.ts`. Run the
[Knowledge playground](/playground/?scenario=knowledge) or copy the full
[Knowledge example](/examples/knowledge/) to see the view in a working app.

A view is eligible only when the validated task, result, presentation policy,
and manifest agree. The optional `assess` callback belongs on the manifest
and must make a synchronous, pure, bounded quality assessment; it does not
replace eligibility checks.

## Extension contract

- Use a stable namespaced ID and revision in both references.
- Declare the configuration schema, roles, operations, result requirement, child bounds, and visibility.
- Set `extension: true`; the renderer is trusted host code, not model output.
- Resolve configuration with declared fields, ports, and operations.
- Render an explicit empty or failure state when the authorized result lacks the expected row.
- Register state mappings when a transition must preserve selection, draft, focus, or navigation state.

If a view can express its needs through the existing Task, Result, presentation manifest, and state mapping, it belongs in consumer code. See [adaptive regions](/guides/adaptive-region/) for selection and [state ownership](/concepts/state-ownership/) for transitions.

## Native React views

Applications using `@aeliqo/react/surface` can register a trusted React
component with `defineReactViews`. Use `render` for an already loaded component
or `load` for a route-split module:

```tsx
import { defineReactViews } from '@aeliqo/react/surface';

const views = defineReactViews([
  {
    id: 'people.native-detail',
    revision: '1',
    load: () => import('./PeopleDetail.js').then(module => module.default),
  },
]);
```

The native adapter renders in the existing React tree, so application context,
portals, and controlled inputs keep their normal React ownership. Automatic
selection still requires a registered presentation candidate and committed
Result evidence. While a new view loads, the previous authorized view remains
mounted. If loading fails, it remains usable and the adapter offers Retry;
revocation or a new scope target removes it immediately. The host owns the
loader and must make failed imports retryable. Change the view revision when
its implementation changes. See the
[@aeliqo/react package guide](/reference/packages/) for the full surface API.
