---
component: 'visualization.area'
title: 'Area'
family: 'visualization'
contract: 'Temporal area/stack with compatible additive measures; reject misleading nonadditive stacking.'
---

## Import and live example

{{aeliqo:example}}

## Purpose

Area shows how a quantitative series changes across ordered time values, with a filled shape that makes
magnitude salient. The bound visualization must declare compatible additive measures before stacking; the
component does not invent aggregation from raw rows.

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

This page documents the unreleased 0.5.0 candidate source. The stable npm
release remains 0.4.2; candidate API and behavior details here are not a
guarantee of availability in the stable release.
