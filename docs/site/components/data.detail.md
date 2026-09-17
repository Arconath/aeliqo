---
component: 'data.detail'
title: 'Detail'
family: 'data'
contract: 'Selected entity facts including missing fields; record identity persists across views.'
---

## Minimal example

{{aeliqo:minimal-example}}

## Import and live example

{{aeliqo:example}}

## Purpose

Selected entity facts including missing fields; record identity persists across views.

## When to use it

{{aeliqo:fixture}}

## When to use a different component

Use KeyValue for a compact group of facts without record identity. Detail makes the selected record and missing fields explicit.

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

Long field values wrap within the detail region. Keep record identity visible when the host moves detail below the list.

## Style hooks

{{aeliqo:style-hooks}}

{{aeliqo:performance}}

## Related components

- [KeyValue](/components/data.key-value/)
- [RecordEditor](/components/compound.record-editor/)

## Generated TypeScript declaration

{{aeliqo:declaration}}

## Version

Aeliqo 0.4.0.
