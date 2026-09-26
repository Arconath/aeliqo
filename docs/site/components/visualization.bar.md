---
component: 'visualization.bar'
title: 'Bar'
family: 'visualization'
contract: 'Comparable quantitative categories; baseline and negative values correctly represented.'
---

## Import and live example

{{aeliqo:example}}

## Purpose

Bar compares a declared quantitative measure across categories from an authorized Result. The view keeps
negative values and its baseline visible; the data table supplies exact values when visual marks are
insufficient. A standard data recipe can choose this view for eligible analysis tasks.

## When to use it

{{aeliqo:fixture}}

## When to use a different component

Use Histogram for a declared binned measure. Use Area for continuous magnitude over time.

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

The plot and its data view stay in a scrollable viewport. Set dimensions from the host and keep category labels readable.

## Style hooks

{{aeliqo:style-hooks}}

{{aeliqo:performance}}

## Related components

- [Histogram](/components/visualization.histogram/)
- [Area](/components/visualization.area/)

## Generated TypeScript declaration

{{aeliqo:declaration}}

## Version

This page documents the Aeliqo 0.5 component contract. Keep every installed
Aeliqo package on the same exact version and check the release status
before installing from the registry.
