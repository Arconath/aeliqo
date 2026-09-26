---
component: 'visualization.calendar-grid'
title: 'CalendarGrid'
family: 'visualization'
contract: 'Calendar-aligned values/events with an explicit week start and exact values beyond color.'
---

## Import and live example

{{aeliqo:fixture}}

{{aeliqo:example}}

## Purpose

Place values on calendar days using the declared week start. Exact values stay in the data table, not in color alone.

## When to use it

- Spot daily patterns like activity by weekday or week.
- Show values on real calendar days with a chosen week start.
- Keep exact values readable beyond color intensity.

## When to use a different component

- Use Timeline for sequence or elapsed time instead of calendar cells.
- Use Heatmap for two chosen dimensions rather than calendar days.

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

The calendar grid has a narrow-width data layout. Check dates and values at 360px and 200% text.

## Style hooks

{{aeliqo:style-hooks}}

{{aeliqo:performance}}

## Related components

- [Timeline](/components/visualization.timeline/)
- [Heatmap](/components/visualization.heatmap/)

## Generated TypeScript declaration

{{aeliqo:declaration}}

## Version

This page documents the Aeliqo 0.5 component contract. Keep every installed
Aeliqo package on the same exact version and check the release status
before installing from the registry.
