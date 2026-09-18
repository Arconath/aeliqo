---
component: 'compound.form-flow'
title: 'FormFlow'
family: 'compound'
contract: 'Task-based steps, draft persistence, validation and reversible navigation before commit.'
---

## Import and live example

{{aeliqo:example}}

## Purpose

Task-based steps, draft persistence, validation and reversible navigation before commit.

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

Aeliqo 0.4.1.
