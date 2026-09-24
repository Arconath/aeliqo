---
component: 'input.date-range'
title: 'DateRange'
family: 'input'
contract: 'Explicit inclusive/exclusive boundaries, timezone/calendar policy and keyboard operation.'
---

## Import and live example

{{aeliqo:example}}

## Purpose

Edit a start and end calendar date together and emit a range value that includes boundary and calendar meaning. The current value uses the Gregorian calendar and `timezone: 'calendar'`; inclusive ranges allow equal endpoints, while exclusive ranges require the start to precede the end.

## When to use it

{{aeliqo:fixture}}

## When to use a different component

Use DateField for one calendar date. A range needs explicit boundary and timezone meaning.

## Properties and defaults

{{aeliqo:properties}}

## Events

{{aeliqo:events}}

## States and failure handling

Relevant states:

{{aeliqo:states}}

{{aeliqo:outcome}}

The range is invalid when a required endpoint is missing or the endpoints are
out of order. The event detail includes both dates, the boundary policy,
`timezone: 'calendar'`, `calendar: 'gregory'`, and validity. Native form
submission contributes only `${name}[start]` and `${name}[end]` when the pair
is valid; the host must carry the boundary and calendar policy into any query
or action instead of inferring them from those two submitted fields.

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

This page documents the 0.5.0 component contract. Keep every installed
Aeliqo package on the same exact version and check the release status
before installing from the registry.
