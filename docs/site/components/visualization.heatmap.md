---
component: 'visualization.heatmap'
title: 'Heatmap'
family: 'visualization'
contract: 'Two dimensions and one measure; accessible exact cell values and readable color key.'
---

## Import and live example

{{aeliqo:example}}

## Purpose

Heatmap encodes a measure over two declared dimensions with a color key. The accompanying data table
keeps exact cell values available without relying on color, and binding requires the host's authorized
Result and field meanings.

## When to use it

{{aeliqo:fixture}}

## When to use a different component

Use Matrix when values should be compared in a table grid. Use CalendarGrid when one axis is calendar days.

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

The plot and its data view stay in a scrollable viewport. Preserve both dimension labels when the host narrows the view.

## Style hooks

{{aeliqo:style-hooks}}

{{aeliqo:performance}}

## Related components

- [Matrix](/components/visualization.matrix/)
- [CalendarGrid](/components/visualization.calendar-grid/)

## Generated TypeScript declaration

{{aeliqo:declaration}}

## Version

This page documents the Aeliqo 0.5 component contract. Keep every installed
Aeliqo package on the same exact version and check the release status
before installing from the registry.
