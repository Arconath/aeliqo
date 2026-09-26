---
id: "standalone"
path: "/start/standalone-components/"
section: "Get started"
title: "Standalone web components"
description: "Use a published component directly when the application already owns rows and interaction state."
---

<p class="lead">A Region is optional. Standalone components are the smaller choice for an existing screen that only needs a table, form control, navigation element, feedback pattern, or chart.</p>
<h2>Register narrowly</h2>

**records.ts**

```ts
import {AeliqoRecordListElement} from '@aeliqo/web/record-list';

if (!customElements.get('aeliqo-record-list')) {
  customElements.define('aeliqo-record-list', AeliqoRecordListElement);
}

const list = document.querySelector('aeliqo-record-list');
list.identity = ['id'];
list.columns = [{key: 'name', label: 'Name'}];
list.rows = [{id: 'ada', name: 'Ada Chen'}];
```


<h2>Boundary rules</h2><div class="doc-checklist"><ul><li>Pass arrays and objects as properties, not serialized attributes.</li><li>Treat emitted event detail as untrusted input and recheck permissions before a side effect.</li><li>Exercise loading, empty, partial, stale, denied, and error states that apply.</li><li>Use public theme tokens and shadow parts; do not depend on internal shadow markup.</li></ul></div>
<nav class="doc-next" aria-label="Continue reading"><p>Continue reading</p><a href="/components/"><span>Component catalog</span><small>Inspect generated declarations, states, examples, and styling hooks.</small><b aria-hidden="true">→</b></a><a href="/guides/adaptive-region/"><span>Upgrade to a Region</span><small>Add typed intent and adaptive recipe selection.</small><b aria-hidden="true">→</b></a></nav>
