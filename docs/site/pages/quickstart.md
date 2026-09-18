---
id: "quickstart"
path: "/start/"
section: "Start"
title: "Quickstart: one adaptive resource"
description: "Define People, connect permitted local records, mount a Region, and render table or cards from one intent."
---

<p class="lead">You will build a People collection that uses a table in a wide container and cards in a narrow container. The intent is explicit, the data is synthetic, and no model call is involved.</p>
<div class="docs-inline-cta"><p><strong>What you will finish with:</strong> one <code>createAeliqoApp</code>, one mounted Region, and one <code>app.render</code> call.</p><a href="/playground/?scenario=people">Preview the result →</a></div>
<aside class="doc-callout" data-tone="note"><strong>Prerequisites</strong><p>Use Node.js 24, pnpm 11, TypeScript, and a browser entry with one empty element such as <code>&lt;main id="people"&gt;&lt;/main&gt;</code>. Keep all Aeliqo packages on one exact version.</p></aside>
<h2>1. Install</h2><p>Install the core contract, runtime orchestration, and web renderer together at the same version.</p>

**Terminal**

```sh
npm install --save-exact \
  @aeliqo/core@0.4.1 \
  @aeliqo/runtime@0.4.1 \
  @aeliqo/web@0.4.1
```


<h2>2. Define the resource and runtime</h2><p>This is the complete application wiring. It defines meaning, connects a bounded local source, supplies trusted authority, and mounts one Region. The docs build reads it from a type-checked fixture—there is no hidden helper file.</p>
<aeliqo-source data-label="src/app.ts" data-path="examples/quickstart/src/app.ts"></aeliqo-source>
<h2>3. Mount and render an intent</h2><p>The browser only needs a target element and the intent you want to show. The runtime handles validation, evaluation, view selection, and lifecycle.</p>

**browser.ts**

```ts
import {mountPeople} from './app.js';

const people = mountPeople(document.querySelector('#people'), [
  {id: 'ada', name: 'Ada Chen', team: 'Design'},
  {id: 'sam', name: 'Sam Rivera', team: 'Engineering'},
]);

const receipt = await people.render();
if (receipt.status !== 'renderer-ready') console.error(receipt.diagnostics);
```


<h2>What you supplied</h2><p>The schema and field roles establish meaning. The local service establishes data and read limits. The authority adapter supplies trusted current context. The mount identifies one Region. Aeliqo compiles the browse intent and chooses the registered responsive recipe.</p>
<h2>What you should see</h2><div class="doc-checklist"><ul><li>Wide Region: a keyboard-accessible table with Name and Team.</li><li>Narrow Region: equivalent cards with the same records and selection identity.</li><li>A denied principal: a typed denied receipt, not leaked rows.</li><li>A newer render request: cancellation of obsolete work so late results cannot commit.</li></ul></div>
<h2>Failure recovery</h2><div class="doc-table"><table><thead><tr><th>Outcome</th><th>Fix</th></tr></thead><tbody><tr><th><code>unsupported</code></th><td>Check the resource intent and allowed view registrations.</td></tr><tr><th><code>denied</code></th><td>Fix host authorization; never add a grant to the intent payload.</td></tr><tr><th><code>failed</code></th><td>Read the bounded diagnostic and keep the previous valid view.</td></tr><tr><th><code>cancelled</code></th><td>Usually expected after a newer render or disposal; do not retry blindly.</td></tr></tbody></table></div>
<nav class="doc-next" aria-label="Continue reading"><p>Continue reading</p><a href="/guides/resources/"><span>Define resources</span><small>Add business meaning, forms, and presentations.</small><b aria-hidden="true">→</b></a><a href="/guides/adaptive-region/"><span>Region lifecycle</span><small>Handle render, subscribe, cancellation, and disposal.</small><b aria-hidden="true">→</b></a></nav>
