---
component: 'input.form'
title: 'Form'
family: 'input'
contract: 'Native submission semantics, draft validation, error summary and explicit host action; rerender never submits.'
---

## Import and live example

{{aeliqo:example}}

## Purpose

Provide a native form boundary around slotted controls and emit a typed submit proposal only after applicable constraint validation. Invalid submission focuses an error summary; the host performs every action and decides whether a reset is accepted.

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

This page documents the unreleased 0.5.0 candidate source. The stable npm
release remains 0.4.2; candidate API and behavior details here are not a
guarantee of availability in the stable release.
