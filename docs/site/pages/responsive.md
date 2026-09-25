---
id: 'responsive'
path: '/guides/responsive-behavior/'
section: 'Build'
title: 'Responsive behavior'
description: 'Adapt registered views from container conditions without another model call or silent information loss.'
---

<p class="lead">The default policy considers the task, semantics, allowed recipes, and Region container—not only viewport or user agent.</p>
<h2>Default behavior</h2><div class="doc-table"><table><thead><tr><th>Need</th><th>Wide (≥640px)</th><th>Narrow (&lt;640px)</th></tr></thead><tbody><tr><th>Browse</th><td>Table first, then cards, list, or trend</td><td>Cards first, then table, list, or trend</td></tr><tr><th>Detail</th><td>Detail view</td><td>Same candidates in the same order — size alone does not create a split layout</td></tr><tr><th>Create/edit</th><td>The registered form</td><td>The same registered form; each form view owns its internal responsive layout</td></tr><tr><th>Compare</th><td>Two-pane split when a fresh compare intent names exactly two identities</td><td>A single equivalent view; an already-mounted view does not upgrade to the split when widened</td></tr><tr><th>Analyze</th><td>Bar or trend when the result supports it, else table</td><td>Same candidates in the same order</td></tr></tbody></table></div>
<aside class="doc-callout" data-tone="note"><strong>Table does not always become cards</strong><p>If simultaneous column comparison is essential, an accessible horizontally scrollable table may be the correct narrow view. The task contract wins over a cosmetic breakpoint.</p></aside>
<h2>Constrain the choice</h2><p>The resource’s presentation policy decides which views adaptation may pick. A narrow container can only select an allowed view; a per-intent preference is a ranking input, not a guarantee:</p>

**resource.ts**

```ts
const people = defineResource({
  // schema, identity, fields…
  presentation: {
    allowedViews: ['table', 'cards'], // narrow containers may only pick 'cards'
    preferred: { analyze: 'trend' }, // a preference, never a bypass
  },
});
```

<p>A resource that allows only <code>table</code> stays a table on every container.</p>
<h2>Transition guards</h2><p>Adaptation coalesces resize signals, follows live pointer, hover, reduced-motion, and forced-colors media changes, and waits through active typing, IME composition, drag, and dirty draft transitions. If no equivalent allowed view exists, it keeps the current valid presentation.</p>
<h2>What triggers adaptation</h2><p>A Region re-resolves its presentation when a new intent renders, when its own container crosses a size boundary, or when a sampled media preference changes. Executing an action or mutating data does not re-pick the view by itself—send a new intent (or call <code>render</code> again) when the response should change the presentation. A page with several independent Regions is orchestrated by the host; each Region adapts its own container.</p>
<nav class="doc-next" aria-label="Continue reading"><p>Continue reading</p><a href="/guides/adaptive-region/"><span>Adaptive Region</span><small>Use the lifecycle and inspect selected recipes.</small><b aria-hidden="true">→</b></a><a href="/guides/custom-views/"><span>Custom views</span><small>Add a domain-specific renderer without changing core.</small><b aria-hidden="true">→</b></a></nav>
