---
component: 'input.slider'
title: 'Slider'
family: 'input'
contract: 'Bounded quantity with keyboard and text alternative; steps and units are declared.'
---

## Import and live example

{{aeliqo:example}}

## Purpose

Edit one bounded numeric quantity with a native range control and a visible value and unit. The component applies `min`, `max`, and `step` to user changes; the host interprets the quantity and accepts its proposal.

## When to use it

{{aeliqo:fixture}}

## When to use a different component

Use NumberField when an exact value matters or people need to type digits. Slider suits a bounded continuous choice.

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
