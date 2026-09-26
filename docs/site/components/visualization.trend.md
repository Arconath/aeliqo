---
component: 'visualization.trend'
title: 'Trend'
family: 'visualization'
contract: 'Temporal metric series, declared grain, gaps and exact accessible summaries.'
---

## Import and live example

{{aeliqo:example}}

## Purpose

Trend plots an application-supplied temporal visualization against exact Result rows and declared field
meanings. It preserves gaps rather than inventing points, and pairs the graphic with exact values in an
accessible data table. Use it directly, through a semantic binding, or as an
eligible standard recipe choice for browse and analyze results. The recipe
requires a compatible time field, measure, and permitted renderer.

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

This page documents the Aeliqo 0.5 component contract. Keep every installed
Aeliqo package on the same exact version and check the release status
before installing from the registry.
