---
component: 'input.radio-group'
title: 'RadioGroup'
family: 'input'
contract: 'One selected option; native semantics or APG-equivalent keyboard behavior.'
---

## Import and live example

{{aeliqo:example}}

## Purpose

Present a bounded set of native radio options under one legend and submit one chosen value. Disabled options stay visible; the selected value is reflected from host state and change events are proposals.

## When to use it

{{aeliqo:fixture}}

## When to use a different component

Use Select for a compact list that need not stay visible. Use checkboxes when options can be selected independently.

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

This page documents the 0.5.0 component contract. Keep every installed
Aeliqo package on the same exact version and check the release status
before installing from the registry.
