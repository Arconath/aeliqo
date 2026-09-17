---
component: 'data.selection-summary'
title: 'SelectionSummary'
family: 'data'
contract: 'Disclose selected identities or server predicate scope; never imply unobserved global selection.'
---

## Minimal example

{{aeliqo:minimal-example}}

## Import and live example

{{aeliqo:example}}

## Purpose

Disclose selected identities or server predicate scope; never imply unobserved global selection.

## When to use it

{{aeliqo:fixture}}

## When to use a different component

Use FilterBuilder when people need to change the predicate. SelectionSummary reports the existing scoped selection and clear request.

## Properties and defaults

{{aeliqo:properties}}

## Events

{{aeliqo:events}}

## States and failure handling

Relevant states:

{{aeliqo:states}}

{{aeliqo:outcome}}

## Keyboard, focus, and accessibility

Keyboard behavior:

{{aeliqo:keyboard}}

Exposed semantics:

{{aeliqo:semantics}}

## Responsive behavior

Let the count, scope, and clear action wrap together. Keep the scope associated with the selected count.

## Style hooks

{{aeliqo:style-hooks}}

{{aeliqo:performance}}

## Related components

- [FilterBuilder](/components/data.filter-builder/)
- [Table](/components/data.table/)

## Generated TypeScript declaration

{{aeliqo:declaration}}

## Version

Aeliqo 0.4.0.
