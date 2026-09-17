---
component: 'data.delta'
title: 'Delta'
family: 'data'
contract: 'Explicit compatible baseline; zero denominator and percentage-point versus relative change distinguished.'
---

## Minimal example

{{aeliqo:minimal-example}}

## Import and live example

{{aeliqo:example}}

## Purpose

Explicit compatible baseline; zero denominator and percentage-point versus relative change distinguished.

## When to use it

{{aeliqo:fixture}}

## When to use a different component

Use Metric when only one value is available. Delta needs compatible current and baseline values from the host.

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

Keep current and baseline context with the change. Stack the values at narrow widths rather than dropping either one.

## Style hooks

{{aeliqo:style-hooks}}

{{aeliqo:performance}}

## Related components

- [Metric](/components/data.metric/)
- [Table](/components/data.table/)

## Generated TypeScript declaration

{{aeliqo:declaration}}

## Version

Aeliqo 0.4.0.
