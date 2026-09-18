---
component: 'input.form'
title: 'Form'
family: 'input'
contract: 'Native submission semantics, draft validation, error summary and explicit host action; rerender never submits.'
---

## Import and live example

{{aeliqo:example}}

## Purpose

Native submission semantics, draft validation, error summary and explicit host action; rerender never submits.

## When to use it

{{aeliqo:fixture}}

## When to use a different component

Use FieldGroup to group controls without submission. Form emits a submit proposal; the host validates and persists.

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

Stack fields and submit actions on narrow screens. Preserve DOM order and keep validation messages beside their fields.

## Style hooks

{{aeliqo:style-hooks}}

{{aeliqo:performance}}

## Related components

- [FieldGroup](/components/input.field-group/)
- [FormFlow](/components/compound.form-flow/)

## Generated TypeScript declaration

{{aeliqo:declaration}}

## Version

Aeliqo 0.4.2.
