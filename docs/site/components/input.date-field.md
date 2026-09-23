---
component: 'input.date-field'
title: 'DateField'
family: 'input'
contract: 'Calendar date rather than timezone-shifted timestamp; typed entry and picker agree.'
---

## Import and live example

{{aeliqo:example}}

## Purpose

Calendar date rather than timezone-shifted timestamp; typed entry and picker agree.

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

This page documents the unreleased 0.5.0 candidate source. The stable npm
release remains 0.4.2; candidate API and behavior details here are not a
guarantee of availability in the stable release.
