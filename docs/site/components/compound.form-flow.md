---
component: 'compound.form-flow'
title: 'FormFlow'
family: 'compound'
contract: 'Task-based steps, draft persistence, validation and reversible navigation before commit.'
---

## Import and live example

{{aeliqo:example}}

## Purpose

FormFlow shows one named step at a time while collecting draft values from slotted controls. It checks
the current step before forward navigation, emits step and commit proposals, and waits for
application-owned active-step and validation updates.

## When to use it

{{aeliqo:fixture}}

## When to use a different component

Use Form for one-step submission. FormFlow is for a sequence with preserved drafts, validation, review, and a host-owned commit.

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

Keep the step label, validation, draft, and navigation in DOM order. Let the flow become one column as space decreases.

## Style hooks

{{aeliqo:style-hooks}}

{{aeliqo:performance}}

## Related components

- [Form](/components/input.form/)
- [Dialog](/components/feedback.dialog/)

## Generated TypeScript declaration

{{aeliqo:declaration}}

## Version

This page documents the 0.5.0 component contract. Keep every installed
Aeliqo package on the same exact version and check the release status
before installing from the registry.
