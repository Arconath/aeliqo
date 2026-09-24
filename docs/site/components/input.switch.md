---
component: 'input.switch'
title: 'Switch'
family: 'input'
contract: 'Binary setting with visible label; changing setting is not implicit business submission.'
---

## Import and live example

{{aeliqo:example}}

## Purpose

Present one binary setting with a native checkbox that exposes switch semantics. Toggling changes the local checked state and emits a typed change; application code decides whether that setting change has any business effect.

## When to use it

{{aeliqo:fixture}}

## When to use a different component

Use Checkbox for a form choice or a state that can be mixed. Switch is for a boolean preference.

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

This page documents the 0.5.0 component contract. Keep every installed
Aeliqo package on the same exact version and check the release status
before installing from the registry.
