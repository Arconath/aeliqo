---
component: 'input.search-field'
title: 'SearchField'
family: 'input'
contract: 'Explicit/debounced query policy; composition input is not submitted mid-IME.'
---

## Minimal example

{{aeliqo:minimal-example}}

## Import and live example

{{aeliqo:example}}

## Purpose

Explicit/debounced query policy; composition input is not submitted mid-IME.

## When to use it

{{aeliqo:fixture}}

## When to use a different component

Use Combobox when the query selects from known entities. SearchField leaves query interpretation and execution with the host.

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

Let the query field use the available row width. Keep search policy and empty feedback visible when the form stacks.

## Style hooks

{{aeliqo:style-hooks}}

{{aeliqo:performance}}

## Related components

- [Combobox](/components/input.combobox/)
- [SearchResults](/components/compound.search-results/)

## Generated TypeScript declaration

{{aeliqo:declaration}}

## Version

Aeliqo 0.4.0.
