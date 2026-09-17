---
id: "resources"
path: "/guides/resources/"
section: "Build"
title: "Define resources"
description: "Describe runtime shape, stable identity, business meaning, forms, and allowed presentations in one application-owned definition."
---

<p class="lead">A resource is the trusted bridge between domain data and Aeliqo. Zod provides runtime validation; metadata explains what fields mean and which UI choices are valid.</p>
<h2>Minimal definition</h2>

**people.ts**

```ts
import {defineResource} from '@aeliqo/core';
import {z} from 'zod';

export const people = defineResource({
  id: 'people', revision: 'people-1', label: 'People', identity: ['id'],
  schema: z.object({id: z.string(), name: z.string(), team: z.enum(['Design', 'Engineering'])}),
  fields: {name: {label: 'Name'}, team: {label: 'Team', role: 'dimension'}},
  presentation: {allowedViews: ['table', 'cards']},
});
```


<h2>Identity is mandatory</h2><p>Identity preserves selection, detail targeting, revisions, and state transfer. It is not a display label and is not inferred from row order.</p>
<h2>Closed values are part of the contract</h2><p>Zod enum and literal values are exposed through permitted context and validated before a query runs. A filter must use the exact registered value; a model cannot silently turn <code>Open</code> into an unrelated or empty result by sending <code>open</code>.</p>
<h2>Technical type is not business meaning</h2><p>A numeric field only says how a value is represented. Aggregation, unit, temporal grain, and definitions such as “absence rate” belong in a versioned Catalog meaning. Add reviewed <code>meanings</code> to a generated resource or pass an existing Catalog; Aeliqo never assumes every number is summable or every date forms a valid trend. Generated date schemas use an explicit Gregorian/UTC/day policy unless field metadata supplies a different semantic type.</p>
<h2>Use an existing Catalog</h2><p>Pass <code>catalog</code> and <code>entity</code> when the application already maintains a richer relational contract. The Zod schema must still cover the selected entity fields so runtime records remain inspectable.</p>
<aside class="doc-callout" data-tone="boundary"><strong>Unsupported schema</strong><p>Nested objects are not silently flattened into analytics. Project them into stable scalar fields or bind them to a typed custom presentation. The diagnostic points to the unsupported field.</p></aside>
<nav class="doc-next" aria-label="Continue reading"><p>Continue reading</p><a href="/concepts/semantics/"><span>Semantic meaning</span><small>Model units, measures, grain, and temporal policy.</small><b aria-hidden="true">→</b></a><a href="/guides/data/"><span>Connect data</span><small>Bind the resource to a bounded source.</small><b aria-hidden="true">→</b></a></nav>
