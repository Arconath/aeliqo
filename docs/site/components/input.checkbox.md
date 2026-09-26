---
component: 'input.checkbox'
title: 'Checkbox'
family: 'input'
contract: 'Native checked/indeterminate state; group ownership and submitted value are explicit.'
---

## Import and live example

{{aeliqo:fixture}}

{{aeliqo:example}}

## Purpose

A native checkbox for one checked value, with an explicit indeterminate display. A user change clears indeterminate and emits a proposal the host accepts or rejects.

## When to use it

- You need a yes/no answer inside a submitted form.
- One item can be included or excluded on its own.
- The group needs an indeterminate state, such as a partial selection.

## When to use a different component

- Use [Switch](/components/input.switch/) for a preference that takes effect outside form submission.
- Use [RadioGroup](/components/input.radio-group/) when the person must pick exactly one named option.

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

Let the label wrap beside the control without shrinking its target. Keep the text associated when fields stack.

## Style hooks

{{aeliqo:style-hooks}}

{{aeliqo:performance}}

## Related components

- [Switch](/components/input.switch/)
- [RadioGroup](/components/input.radio-group/)

## Generated TypeScript declaration

{{aeliqo:declaration}}

## Version

This page documents the Aeliqo 0.5 component contract. Keep every installed
Aeliqo package on the same exact version and check the release status
before installing from the registry.
