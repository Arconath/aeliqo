---
component: 'input.text-area'
title: 'TextArea'
family: 'input'
contract: 'Multiline editing preserves draft, selection and composition across unrelated updates.'
---

## Import and live example

{{aeliqo:example}}

## Purpose

Multiline editing preserves draft, selection and composition across unrelated updates.

## When to use it

{{aeliqo:fixture}}

## When to use a different component

Use TextField when only one line is valid. Use Form to coordinate submission and validation across controls.

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

Rows set the starting height. Keep the draft readable when the form narrows and preserve line breaks as it grows.

## Style hooks

{{aeliqo:style-hooks}}

{{aeliqo:performance}}

## Related components

- [TextField](/components/input.text-field/)
- [Form](/components/input.form/)

## Generated TypeScript declaration

{{aeliqo:declaration}}

## Version

Aeliqo 0.4.1.
