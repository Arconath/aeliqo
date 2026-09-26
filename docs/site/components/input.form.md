---
component: 'input.form'
title: 'Form'
family: 'input'
contract: 'Native submission semantics, draft validation, error summary and explicit host action; rerender never submits.'
---

## Import and live example

{{aeliqo:fixture}}

{{aeliqo:example}}

## Purpose

A native form boundary around slotted controls that emits a submit proposal after constraint validation. Invalid submits focus an error summary; a rerender never submits.

## When to use it

- Several controls submit together under one action.
- Native constraint validation should run before the submit proposal.
- Invalid submission should move focus to an error summary.
- The host performs the action and decides whether a reset is accepted.

## When to use a different component

- Use [FieldGroup](/components/input.field-group/) when controls need grouping but no submission.
- Use [FormFlow](/components/compound.form-flow/) when the task spans multiple steps before commit.

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

This page documents the Aeliqo 0.5 component contract. Keep every installed
Aeliqo package on the same exact version and check the release status
before installing from the registry.
