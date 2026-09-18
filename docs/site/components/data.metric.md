---
component: 'data.metric'
title: 'Metric'
family: 'data'
contract: 'One validated value or aggregate with units, scope and unavailable state.'
---

## Import and live example

{{aeliqo:example}}

## Purpose

One validated value or aggregate with units, scope and unavailable state.

## When to use it

{{aeliqo:fixture}}

## When to use a different component

Use Delta to compare compatible values. Metric reports one supplied value with its label and scope.

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

Let long labels and formatted values wrap instead of clipping. Keep the unit visually associated with the value at text zoom.

## Style hooks

{{aeliqo:style-hooks}}

{{aeliqo:performance}}

## Related components

- [Delta](/components/data.delta/)
- [Trend](/components/visualization.trend/)

## Generated TypeScript declaration

{{aeliqo:declaration}}

## Version

Aeliqo 0.4.1.
