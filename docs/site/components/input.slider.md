---
component: 'input.slider'
title: 'Slider'
family: 'input'
contract: 'Bounded quantity with keyboard and text alternative; steps and units are declared.'
---

## Import and live example

{{aeliqo:fixture}}

{{aeliqo:example}}

## Purpose

A native range control for one bounded quantity with a visible value and unit. It applies `min`, `max`, and `step` to changes; the host interprets the result.

## When to use it

- People adjust a quantity inside declared bounds, such as volume or confidence.
- An approximate position is enough; exact digits are not required.
- The current value and unit should stay visible beside the track.

## When to use a different component

- Use [NumberField](/components/input.number-field/) when the exact value matters or people type digits.
- Use [Form](/components/input.form/) when the value submits alongside other fields.

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

Give the track its own row in narrow forms. Keep its numeric label and unit visible as the viewport shrinks.

## Style hooks

{{aeliqo:style-hooks}}

{{aeliqo:performance}}

## Related components

- [NumberField](/components/input.number-field/)
- [Form](/components/input.form/)

## Generated TypeScript declaration

{{aeliqo:declaration}}

## Version

This page documents the Aeliqo 0.5 component contract. Keep every installed
Aeliqo package on the same exact version and check the release status
before installing from the registry.
