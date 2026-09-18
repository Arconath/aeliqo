---
component: 'visualization.area'
title: 'Area'
family: 'visualization'
contract: 'Temporal area/stack with compatible additive measures; reject misleading nonadditive stacking.'
---

## Import and live example

{{aeliqo:example}}

## Purpose

Temporal area/stack with compatible additive measures; reject misleading nonadditive stacking.

## When to use it

{{aeliqo:fixture}}

## When to use a different component

Use Trend for a line-focused change over time. Use Scatter to compare two measures for each record.

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

The plot and its data view stay in a scrollable viewport. Set dimensions from the host and retain the declared missing-value treatment.

## Style hooks

{{aeliqo:style-hooks}}

{{aeliqo:performance}}

## Related components

- [Trend](/components/visualization.trend/)
- [Scatter](/components/visualization.scatter/)

## Generated TypeScript declaration

{{aeliqo:declaration}}

## Version

Aeliqo 0.4.1.
