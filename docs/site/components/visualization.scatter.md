---
component: 'visualization.scatter'
title: 'Scatter'
family: 'visualization'
contract: 'Two quantitative axes, declared units, stable point selection and noncausal interpretation.'
---

## Import and live example

{{aeliqo:example}}

## Purpose

Scatter positions each supplied record using two declared quantitative axes. Its point selection refers
to a stable Result identity, while the exact data table preserves values that are hard to read from the
plot. Proximity is a visual relationship, not evidence of causation.

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

This page documents the unreleased 0.5.0 candidate source. The stable npm
release remains 0.4.2; candidate API and behavior details here are not a
guarantee of availability in the stable release.
