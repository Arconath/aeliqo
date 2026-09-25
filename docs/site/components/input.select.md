---
component: 'input.select'
title: 'Select'
family: 'input'
contract: 'Bounded enumerated choice with native-first semantics; empty and unknown value are distinct.'
---

## Import and live example

{{aeliqo:example}}

## Purpose

Present a bounded choice list through a native select. An empty value is distinct from a selected option, and a value missing from the current list remains visible as an unknown option instead of silently selecting another one.

## When to use it

{{aeliqo:fixture}}

## When to use a different component

Use Combobox when people need to search a longer bounded list. Use RadioGroup when the choices should stay visible.

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

Give the field enough width to show its selected label. Keep options bounded so the list fits the visible viewport.

## Style hooks

{{aeliqo:style-hooks}}

{{aeliqo:performance}}

## Related components

- [Combobox](/components/input.combobox/)
- [RadioGroup](/components/input.radio-group/)

## Generated TypeScript declaration

{{aeliqo:declaration}}

## Version

This page documents the Aeliqo 0.5 component contract. Keep every installed
Aeliqo package on the same exact version and check the release status
before installing from the registry.
