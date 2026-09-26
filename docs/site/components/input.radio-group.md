---
component: 'input.radio-group'
title: 'RadioGroup'
family: 'input'
contract: 'One selected option; native semantics or APG-equivalent keyboard behavior.'
---

## Import and live example

{{aeliqo:fixture}}

{{aeliqo:example}}

## Purpose

A bounded set of native radio options under one legend that submits one chosen value. Disabled options stay visible, and change events are proposals the host accepts.

## When to use it

- People must pick exactly one of a few named options.
- Every option should stay visible without opening a list.
- Some options can appear disabled without being removed.

## When to use a different component

- Use [Select](/components/input.select/) when the list should stay collapsed to save space.
- Use [Checkbox](/components/input.checkbox/) controls when several options can be selected independently.

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

Vertical orientation suits narrow forms. Let long option labels wrap without changing their stable IDs.

## Style hooks

{{aeliqo:style-hooks}}

{{aeliqo:performance}}

## Related components

- [Select](/components/input.select/)
- [Checkbox](/components/input.checkbox/)

## Generated TypeScript declaration

{{aeliqo:declaration}}

## Version

This page documents the Aeliqo 0.5 component contract. Keep every installed
Aeliqo package on the same exact version and check the release status
before installing from the registry.
