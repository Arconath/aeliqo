---
component: 'visualization.calendar-grid'
title: 'CalendarGrid'
family: 'visualization'
contract: 'Calendar-aligned values/events with an explicit week start and exact values beyond color.'
---

## Import and live example

{{aeliqo:example}}

## Purpose

CalendarGrid places supplied dates into civil-day cells using the declared week start. Exact
values remain in the data table, and unsupported calendar systems retain that data view instead of being
drawn as a misleading Gregorian grid.

## When to use it

{{aeliqo:fixture}}

## When to use a different component

Use Timeline when sequence or elapsed time is the main reading. CalendarGrid groups supplied values by calendar date.

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

This page documents the unreleased 0.5.0 candidate source. The stable npm
release remains 0.4.2; candidate API and behavior details here are not a
guarantee of availability in the stable release.
