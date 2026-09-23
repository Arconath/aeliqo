---
component: 'input.checkbox'
title: 'Checkbox'
family: 'input'
contract: 'Native checked/indeterminate state; group ownership and submitted value are explicit.'
---

## Import and live example

{{aeliqo:example}}

## Purpose

Collect one checked value with a native checkbox and an explicit indeterminate display state. A user change clears indeterminate and emits a typed proposal; the form value and accepted application state remain under host control.

## When to use it

{{aeliqo:fixture}}

## When to use a different component

Use Switch for an on/off preference. Use RadioGroup when a person must choose exactly one of several named options.

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

This page documents the unreleased 0.5.0 candidate source. The stable npm
release remains 0.4.2; candidate API and behavior details here are not a
guarantee of availability in the stable release.
