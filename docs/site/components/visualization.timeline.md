---
component: 'visualization.timeline'
title: 'Timeline'
family: 'visualization'
contract: 'Dated events/intervals with timezone semantics, explicit overlaps and chronological alternative.'
---

## Import and live example

{{aeliqo:example}}

## Purpose

Timeline orders supplied dated events or intervals and lays overlapping intervals into separate lanes
when the declared calendar supports a visual layout. The chronological data table remains available for
exact endpoints and for calendars the graphic cannot render.

## When to use it

{{aeliqo:fixture}}

## When to use a different component

Use CalendarGrid for a calendar-shaped date layout. Timeline is for chronological order or elapsed time.

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

This page documents the 0.5.0 component contract. Keep every installed
Aeliqo package on the same exact version and check the release status
before installing from the registry.
