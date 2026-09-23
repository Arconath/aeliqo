---
component: 'data.selection-summary'
title: 'SelectionSummary'
family: 'data'
contract: 'Disclose selected identities or server predicate scope; never imply unobserved global selection.'
---

## Import and live example

{{aeliqo:example}}

## Purpose

SelectionSummary tells people whether selection contains observed record keys or a server-side predicate.
It never turns a predicate into a claim that every matching record is loaded; Clear selection emits a
request for the application to handle.

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

This page documents the 0.5.0 component contract. Keep every installed
Aeliqo package on the same exact version and check the release status
before installing from the registry.
