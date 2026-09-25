---
component: 'input.number-field'
title: 'NumberField'
family: 'input'
contract: 'Locale-aware editing separates display text from exact numeric value; do not silently round money.'
---

## Import and live example

{{aeliqo:example}}

## Purpose

Let a person edit a localized decimal while preserving the canonical exact value as a string. Validation checks declared minimum, maximum, and step without converting the value to a rounded JavaScript number.

## When to use it

{{aeliqo:fixture}}

## When to use a different component

Use Slider for an approximate choice within a range. NumberField suits exact entry with an editable draft.

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

Leave room for the localized value and unit. Check the editable draft at 200% text so digits are not clipped.

## Style hooks

{{aeliqo:style-hooks}}

{{aeliqo:performance}}

## Related components

- [Slider](/components/input.slider/)
- [DateField](/components/input.date-field/)

## Generated TypeScript declaration

{{aeliqo:declaration}}

## Version

This page documents the Aeliqo 0.5 component contract. Keep every installed
Aeliqo package on the same exact version and check the release status
before installing from the registry.
