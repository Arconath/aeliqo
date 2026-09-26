---
component: 'input.select'
title: 'Select'
family: 'input'
contract: 'Bounded enumerated choice with native-first semantics; empty and unknown value are distinct.'
---

## Import and live example

{{aeliqo:fixture}}

{{aeliqo:example}}

## Purpose

A bounded choice with a styled trigger and chevron; the option popup and keyboard stay native. An empty value is no selection, and an unknown value stays visible instead of picking another option.

## When to use it

- People pick one option from a short, fixed set.
- The choices fit a bounded list that does not need a query.
- Compact display matters more than keeping every option visible.
- Empty and unknown values must stay distinct from a real selection.

## When to use a different component

- Use [Combobox](/components/input.combobox/) when people need to search a longer list.
- Use [RadioGroup](/components/input.radio-group/) when the choices should stay visible.

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
