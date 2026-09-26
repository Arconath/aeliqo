---
id: "forms"
path: "/guides/forms/"
section: "Guides"
title: "Create and edit forms"
description: "Generate registered form recipes from schemas while preserving draft ownership, validation, and the action boundary."
---

<p class="lead">A create or edit intent opens a form; it never performs the write. Submission produces an action preview and follows the registered confirmation policy.</p>
<h2>Register form bindings</h2>

**resource.ts**

```ts
const people = defineResource({
  // schema, identity, fields…
  intents: ['browse', 'detail', 'create', 'edit'],
  forms: {
    create: {schema: {id: 'people-form', revision: '1'}, action: {id: 'people.create', revision: '1'}},
    edit: {schema: {id: 'people-form', revision: '1'}, action: {id: 'people.update', revision: '1'}},
  },
  presentation: {allowedViews: ['table', 'cards', 'form']},
});
```


<h2>Edit state is host-owned evidence</h2><p>Supply a <code>formState</code> adapter for edit values and entity revision. Aeliqo never invents current field values from an agent proposal.</p>
<h2>Standard form labels</h2>
<p>The standard schema-derived form treats <code>resource.label</code> as the
collection name. Its heading is <code>Create a record in ${resource.label}</code>
or <code>Edit a record in ${resource.label}</code>; its submit control reads
<code>Create record</code> or <code>Save changes</code>. A collection label may
be plural, so the standard form does not guess an English singular noun. A
custom host form can supply its own domain-specific copy.</p>
<h2>UX contract</h2><div class="doc-checklist"><ul><li>Visible labels, helper text, inline errors, and a validation summary.</li><li>Dirty draft survives valid responsive adaptation.</li><li>Reset and cancel are explicit and restore focus.</li><li>Nested groups, repeaters, and multiselect use bounded JSON schemas.</li><li>Submission status distinguishes pending, failed, executed, and ambiguous.</li></ul></div>
<nav class="doc-next" aria-label="Continue reading"><p>Continue reading</p><a href="/guides/actions/"><span>Action boundary</span><small>Implement confirmation and idempotency correctly.</small><b aria-hidden="true">→</b></a><a href="/concepts/state-ownership/"><span>Draft ownership</span><small>Prevent state loss during adaptation.</small><b aria-hidden="true">→</b></a></nav>
