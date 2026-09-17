---
component: 'compound.explorer'
title: 'Explorer'
family: 'compound'
contract: 'Filter plus collection plus selected detail using shared parameter/selection state.'
---

## Minimal example

{{aeliqo:minimal-example}}

## Import and live example

{{aeliqo:example}}

## Purpose

Filter plus collection plus selected detail using shared parameter/selection state.

## When to use it

{{aeliqo:fixture}}

## When to use a different component

Use separate FilterBuilder, RecordList, and Detail components when the application already owns panel composition. Explorer coordinates their shared scope and selection.

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

Stack filters, records, and detail in reading order on narrow hosts. Preserve the shared scope and selected identity when panels move.

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
