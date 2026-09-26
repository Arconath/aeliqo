---
component: 'visualization.histogram'
title: 'Histogram'
family: 'visualization'
contract: 'Declared binning, count/density labeling and missing-population disclosure.'
---

## Import and live example

{{aeliqo:fixture}}

{{aeliqo:example}}

## Purpose

Show how one numeric measure distributes across declared bins. Scope text says what the bins do not cover.

## When to use it

- Show the distribution of one measure, like order size.
- Work with bins that have declared boundaries.
- Label counts or density without implying missing rows were counted.

## When to use a different component

- Use Bar when categories already exist instead of numeric bins.
- Use Heatmap to compare a measure across two dimensions.

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

This page documents the Aeliqo 0.5 component contract. Keep every installed
Aeliqo package on the same exact version and check the release status
before installing from the registry.
