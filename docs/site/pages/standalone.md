---
id: "standalone"
path: "/start/standalone-components/"
section: "Get started"
title: "Standalone web components"
description: "Use a published component directly when the application already owns rows and interaction state."
---

<p class="lead">A region is optional. Use a standalone component when your screen already owns the rows and state and only needs a table, form control, or chart.</p>
<h2>Register one element</h2>

**records.ts**

```ts
import { AeliqoRecordListElement } from '@aeliqo/web/record-list';

if (!customElements.get('aeliqo-record-list')) {
  customElements.define('aeliqo-record-list', AeliqoRecordListElement);
}

const list = document.querySelector('aeliqo-record-list');
list.identity = ['id'];
list.columns = [{ key: 'name', label: 'Name' }];
list.rows = [{ id: 'ada', name: 'Ada Chen' }];
```

You should see: an `<aeliqo-record-list>` element render the row you passed.

<h2>Follow the boundary rules</h2><div class="doc-checklist"><ul><li>Pass arrays and objects as properties, not serialized attributes.</li><li>Treat event detail as untrusted input. Recheck permissions before any side effect.</li><li>Exercise the loading, empty, partial, denied, and error states that apply.</li><li>Style with public theme tokens and shadow parts. Do not depend on internal markup.</li></ul></div>
<nav class="doc-next" aria-label="Continue reading"><p>Continue reading</p><a href="/components/"><span>Component catalog</span><small>Inspect props, states, examples, and styling hooks.</small><b aria-hidden="true">→</b></a><a href="/guides/adaptive-region/"><span>Upgrade to a region</span><small>Add typed requests and adaptive view selection.</small><b aria-hidden="true">→</b></a></nav>
