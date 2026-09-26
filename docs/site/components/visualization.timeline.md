---
component: 'visualization.timeline'
title: 'Timeline'
family: 'visualization'
contract: 'Dated events/intervals with timezone semantics, explicit overlaps and chronological alternative.'
---

## Import and live example

{{aeliqo:fixture}}

{{aeliqo:example}}

## Purpose

Order dated events or intervals chronologically. Overlapping intervals get separate lanes; exact dates stay in the data table.

## When to use it

- Show events or spans in chronological order.
- Display overlapping intervals in separate lanes.
- Keep exact start and end times readable beside the graphic.

## When to use a different component

- Use CalendarGrid for a calendar-shaped layout of dates.
- Use Trend for a continuous measure over time.

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

The temporal data view adapts at narrow widths. Preserve calendar meaning and keep dates available with each row.

## Style hooks

{{aeliqo:style-hooks}}

{{aeliqo:performance}}

## Related components

- [CalendarGrid](/components/visualization.calendar-grid/)
- [Trend](/components/visualization.trend/)

## Generated TypeScript declaration

{{aeliqo:declaration}}

## Version

This page documents the Aeliqo 0.5 component contract. Keep every installed
Aeliqo package on the same exact version and check the release status
before installing from the registry.
