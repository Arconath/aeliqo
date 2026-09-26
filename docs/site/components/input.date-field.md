---
component: 'input.date-field'
title: 'DateField'
family: 'input'
contract: 'Calendar date rather than timezone-shifted timestamp; typed entry and picker agree.'
---

## Import and live example

{{aeliqo:example}}

## Purpose

Edit one calendar date through a native date input while preserving date-only values. The component checks its declared bounds and emits changes; the host gives the date its timezone and business meaning before querying data.

## When to use it

{{aeliqo:fixture}}

## When to use a different component

Use DateRange when the task needs both a start and end date. Use Form to coordinate this date with related fields.

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

Leave enough width for the localized date at 200% text. Keep the label and declared bounds available beside the field.

## Style hooks

{{aeliqo:style-hooks}}

{{aeliqo:performance}}

## Related components

- [DateRange](/components/input.date-range/)
- [Form](/components/input.form/)

## Generated TypeScript declaration

{{aeliqo:declaration}}

## Version

This page documents the Aeliqo 0.5 component contract. Keep every installed
Aeliqo package on the same exact version and check the release status
before installing from the registry.
