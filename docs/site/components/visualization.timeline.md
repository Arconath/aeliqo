---
component: 'visualization.timeline'
title: 'Timeline'
family: 'visualization'
contract: 'Dated events/intervals with timezone semantics, explicit overlaps and chronological alternative.'
---

## Import and live example

{{aeliqo:example}}

## Purpose

Dated events/intervals with timezone semantics, explicit overlaps and chronological alternative.

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

This page documents the unreleased 0.5.0 candidate source. The stable npm
release remains 0.4.2; candidate API and behavior details here are not a
guarantee of availability in the stable release.
