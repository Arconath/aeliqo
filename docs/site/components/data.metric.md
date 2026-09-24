---
component: 'data.metric'
title: 'Metric'
family: 'data'
contract: 'One validated value or aggregate with units, scope and unavailable state.'
---

## Import and live example

{{aeliqo:example}}

## Purpose

Metric presents one application-supplied value with a label, optional unit, description, and scope. It
formats numeric values with the chosen locale; a missing value becomes an unavailable state instead of an
invented zero.

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

This page documents the 0.5.0 component contract. Keep every installed
Aeliqo package on the same exact version and check the release status
before installing from the registry.
