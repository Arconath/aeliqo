---
component: 'input.select'
title: 'Select'
family: 'input'
contract: 'Bounded enumerated choice with native-first semantics; empty and unknown value are distinct.'
---

## Import and live example

{{aeliqo:example}}

## Purpose

Bounded enumerated choice with native-first semantics; empty and unknown value are distinct.

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

Aeliqo 0.4.1.
