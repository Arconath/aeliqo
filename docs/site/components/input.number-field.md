---
component: 'input.number-field'
title: 'NumberField'
family: 'input'
contract: 'Locale-aware editing separates display text from exact numeric value; do not silently round money.'
---

## Import and live example

{{aeliqo:fixture}}

{{aeliqo:example}}

## Purpose

A locale-aware number input that keeps display text separate from the exact value. Validation checks declared minimum, maximum, and step without rounding to a JavaScript number.

## When to use it

- You need an exact numeric value, such as money or a measured quantity.
- People type digits that should display in their own locale.
- The value must respect declared minimum, maximum, or step bounds.

## When to use a different component

- Use [Slider](/components/input.slider/) when an approximate position in a range is enough.
- Use [DateField](/components/input.date-field/) when the value is a calendar date.

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
