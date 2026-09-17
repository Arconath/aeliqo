---
id: "custom-views"
path: "/guides/custom-views/"
section: "Build"
title: "Custom views"
description: "Register a typed application renderer with explicit identity, capability, input contract, and lifecycle."
---

<p class="lead">Custom views are trusted application code. They may wrap a Web Component or host framework component, but an agent cannot install them or supply an import path.</p>
<h2>Define and register</h2>

**kanban.ts**

```ts
import { createAeliqoApp } from '@aeliqo/web/app';
import { defineView } from '@aeliqo/web/recipes';

const kanban = defineView({
  manifest: {id: 'support.kanban', revision: '1', intents: ['browse']},
  assess: ({task, result, environment}) => assessKanban(task, result, environment),
  render: ({host, result, signal}) => mountKanban(host, result, signal),
});

const app = createAeliqoApp({resources, authority, views: [kanban]});
```


<h2>Extension contract</h2><div class="doc-checklist"><ul><li>Namespaced identity and version are stable.</li><li>Input schema and supported capabilities are explicit.</li><li>Assessment is synchronous, pure, and bounded.</li><li>Render supports cancellation and complete disposal.</li><li>State mapping declares which selection, draft, focus, and navigation context can transfer.</li><li>Duplicate or incompatible registration fails before use.</li></ul></div>
<h2>Core stays unchanged</h2><p>If a custom view or intent can express its needs through Task, Result, presentation manifest, and state mapping, it belongs in consumer code. Add a core primitive only when multiple independent domains reveal a missing invariant.</p>
<nav class="doc-next" aria-label="Continue reading"><p>Continue reading</p><a href="/examples/knowledge/"><span>Knowledge example</span><small>See content use a custom presentation outside dashboard UI.</small><b aria-hidden="true">→</b></a><a href="/reference/app-api/"><span>Definition reference</span><small>Inspect <code>defineView</code> and <code>defineRecipe</code>.</small><b aria-hidden="true">→</b></a></nav>
