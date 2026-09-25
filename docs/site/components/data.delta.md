---
component: 'data.delta'
title: 'Delta'
family: 'data'
contract: 'Explicit compatible baseline; zero denominator and percentage-point versus relative change distinguished.'
---

## Import and live example

{{aeliqo:example}}

## Purpose

Delta displays the change between an application-supplied current value and baseline. Choose absolute,
relative, or percentage-point mode deliberately; incompatible values and an undefined relative
denominator render as unavailable instead of a misleading number.

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

This page documents the Aeliqo 0.5 component contract. Keep every installed
Aeliqo package on the same exact version and check the release status
before installing from the registry.
