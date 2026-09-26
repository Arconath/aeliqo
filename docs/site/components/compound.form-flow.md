---
component: 'compound.form-flow'
title: 'FormFlow'
family: 'compound'
contract: 'Task-based steps, draft persistence, validation and reversible navigation before commit.'
---

## Import and live example

{{aeliqo:fixture}}

{{aeliqo:example}}

## Purpose

FormFlow walks users through named steps with a persisted draft and per-step validation. Use it when a task splits into ordered, reversible screens before commit.

## When to use it

- A task splits into named steps users move through forward and back.
- Each step must validate before the next step or the commit runs.
- Draft values must persist across steps and keep focus stable.
- Commit is a host proposal; the flow never applies the effect itself.

## When to use a different component

- Use Form when every field fits on one screen.
- Use RecordEditor when save must carry an existing record's key and revision.
- Use Dialog for a short confirmation, not a stepped task.

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

This page documents the Aeliqo 0.5 component contract. Keep every installed
Aeliqo package on the same exact version and check the release status
before installing from the registry.
