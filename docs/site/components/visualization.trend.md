---
component: 'visualization.trend'
title: 'Trend'
family: 'visualization'
contract: 'Temporal metric series, declared grain, gaps and exact accessible summaries.'
---

## Import and live example

{{aeliqo:example}}

## Purpose

Temporal metric series, declared grain, gaps and exact accessible summaries.

## When to use it

{{aeliqo:fixture}}

## When to use a different component

Use Area when magnitude should read as a filled surface and the stacking policy is explicit. Use Metric for one point-in-time value.

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

The plot and its data view stay in a scrollable viewport. Set width and height from the host and retain the labelled data view.

## Style hooks

{{aeliqo:style-hooks}}

{{aeliqo:performance}}

## Related components

- [Area](/components/visualization.area/)
- [Metric](/components/data.metric/)

## Generated TypeScript declaration

{{aeliqo:declaration}}

## Version

Aeliqo 0.4.1.
