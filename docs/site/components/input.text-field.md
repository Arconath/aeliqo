---
component: 'input.text-field'
title: 'TextField'
family: 'input'
contract: 'Label, description, validation, autocomplete and IME-safe controlled/uncontrolled value.'
---

## Import and live example

{{aeliqo:example}}

## Purpose

Edit a single line in a native text input with a persistent label, descriptions, and validation feedback. Controlled and default values share the same field boundary, while composition-aware updates avoid disrupting active typing.

## When to use it

{{aeliqo:fixture}}

## When to use a different component

Use TextArea when more than one line is valid. Use SearchField when the value is a query with a host-owned execution policy.

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

Keep the label, description, and error visible when the form narrows. Put the field on its own row when the label is long.

## Style hooks

{{aeliqo:style-hooks}}

{{aeliqo:performance}}

## Related components

- [TextArea](/components/input.text-area/)
- [SearchField](/components/input.search-field/)

## Generated TypeScript declaration

{{aeliqo:declaration}}

## Version

This page documents the 0.5.0 component contract. Keep every installed
Aeliqo package on the same exact version and check the release status
before installing from the registry.
