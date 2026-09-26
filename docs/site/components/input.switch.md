---
component: 'input.switch'
title: 'Switch'
family: 'input'
contract: 'Binary setting with visible label; changing setting is not implicit business submission.'
---

## Import and live example

{{aeliqo:fixture}}

{{aeliqo:example}}

## Purpose

A labelled on/off setting built on a native checkbox with switch semantics. Toggling emits a typed proposal; it is not an implicit submission.

## When to use it

- A preference turns on or off with immediate visible effect.
- The setting is binary; there is no mixed state.
- The label should stay short and always visible.

## When to use a different component

- Use [Checkbox](/components/input.checkbox/) for a form choice or a state that can be mixed.
- Use [Form](/components/input.form/) when the change submits alongside other fields.

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

Keep explanatory copy outside the short switch label. Preserve the control target when its parent narrows.

## Style hooks

{{aeliqo:style-hooks}}

{{aeliqo:performance}}

## Related components

- [Checkbox](/components/input.checkbox/)
- [Form](/components/input.form/)

## Generated TypeScript declaration

{{aeliqo:declaration}}

## Version

This page documents the Aeliqo 0.5 component contract. Keep every installed
Aeliqo package on the same exact version and check the release status
before installing from the registry.
