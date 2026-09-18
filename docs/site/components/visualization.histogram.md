---
component: 'visualization.histogram'
title: 'Histogram'
family: 'visualization'
contract: 'Declared binning, count/density labeling and missing-population disclosure.'
---

## Import and live example

{{aeliqo:example}}

## Purpose

Declared binning, count/density labeling and missing-population disclosure.

## When to use it

{{aeliqo:fixture}}

## When to use a different component

Use Bar for categories that are already defined. Histogram is for numeric bins with an explicit boundary policy.

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

The plot and its data view stay in a scrollable viewport. Set dimensions from the host and keep bin boundaries labelled.

## Style hooks

{{aeliqo:style-hooks}}

{{aeliqo:performance}}

## Related components

- [Bar](/components/visualization.bar/)
- [Heatmap](/components/visualization.heatmap/)

## Generated TypeScript declaration

{{aeliqo:declaration}}

## Version

Aeliqo 0.4.1.
