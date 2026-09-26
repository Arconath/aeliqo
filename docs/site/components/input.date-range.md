---
component: 'input.date-range'
title: 'DateRange'
family: 'input'
contract: 'Explicit inclusive/exclusive boundaries, timezone/calendar policy and keyboard operation.'
---

## Import and live example

{{aeliqo:fixture}}

{{aeliqo:example}}

## Purpose

A pair of date fields that edits a start and end date as one range value. Boundary policy and calendar meaning travel with the value instead of being inferred.

## When to use it

- You need a start and end date that stay consistent together.
- The range must declare whether its endpoints are inclusive or exclusive.
- Timezone and calendar policy must travel with the submitted value.

## When to use a different component

- Use [DateField](/components/input.date-field/) when only one calendar date is needed.
- Use [Form](/components/input.form/) when the range submits alongside related fields.

## Properties and defaults

{{aeliqo:properties}}

## Events

{{aeliqo:events}}

## States and failure handling

Relevant states:

{{aeliqo:states}}

{{aeliqo:outcome}}

The range is invalid when a required endpoint is missing or the endpoints are
out of order. Inclusive ranges allow equal endpoints; exclusive ranges require
the start to precede the end. The event detail includes both dates, the
boundary policy, `timezone: 'calendar'`, `calendar: 'gregory'`, and validity.
Native form submission contributes only `${name}[start]` and `${name}[end]`
when the pair is valid; the host carries the boundary and calendar policy
into any query or action.

## Keyboard, focus, and accessibility

Keyboard behavior:

{{aeliqo:keyboard}}

Exposed semantics:

{{aeliqo:semantics}}

## Responsive behavior

Stack start and end fields in a narrow form. Keep each label and the range boundary meaning next to its value.

## Style hooks

{{aeliqo:style-hooks}}

{{aeliqo:performance}}

## Related components

- [DateField](/components/input.date-field/)
- [Form](/components/input.form/)

## Generated TypeScript declaration

{{aeliqo:declaration}}

## Version

This page documents the Aeliqo 0.5 component contract. Keep every installed
Aeliqo package on the same exact version and check the release status
before installing from the registry.
