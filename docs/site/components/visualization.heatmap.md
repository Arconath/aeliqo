---
component: 'visualization.heatmap'
title: 'Heatmap'
family: 'visualization'
contract: 'Two dimensions and one measure; accessible exact cell values and readable color key.'
---

## Minimal example

{{aeliqo:minimal-example}}

## Import and live example

{{aeliqo:example}}

## Purpose

Two dimensions and one measure; accessible exact cell values and readable color key.

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

Aeliqo 0.4.0.
