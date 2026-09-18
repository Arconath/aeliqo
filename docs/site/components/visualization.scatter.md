---
component: 'visualization.scatter'
title: 'Scatter'
family: 'visualization'
contract: 'Two quantitative axes, declared units, stable point selection and noncausal interpretation.'
---

## Import and live example

{{aeliqo:example}}

## Purpose

Two quantitative axes, declared units, stable point selection and noncausal interpretation.

## When to use it

{{aeliqo:fixture}}

## When to use a different component

Use Relationship for declared source and target edges. Scatter compares numeric positions and does not imply a link or cause.

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

The plot and its data view stay in a scrollable viewport. Set dimensions from the host and keep point selection operable.

## Style hooks

{{aeliqo:style-hooks}}

{{aeliqo:performance}}

## Related components

- [Relationship](/components/visualization.relationship/)
- [Trend](/components/visualization.trend/)

## Generated TypeScript declaration

{{aeliqo:declaration}}

## Version

Aeliqo 0.4.2.
