---
component: 'data.record-list'
title: 'RecordList'
family: 'data'
contract: 'Scannable records with identity-based selection and reachable additional fields.'
---

## Import and live example

{{aeliqo:example}}

## Purpose

Scannable records with identity-based selection and reachable additional fields.

## When to use it

{{aeliqo:fixture}}

## When to use a different component

Use Table when column comparison, sorting, or page controls dominate. RecordList is for browsing and selecting identified records.

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

Keep rendered row counts bounded for long lists. Preserve stable identity and the selected state as the list width changes.

## Style hooks

{{aeliqo:style-hooks}}

{{aeliqo:performance}}

## Related components

- [CardCollection](/components/data.card-collection/)
- [Table](/components/data.table/)

## Generated TypeScript declaration

{{aeliqo:declaration}}

## Version

Aeliqo 0.4.2.
