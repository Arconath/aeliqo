---
component: 'feedback.popover'
title: 'Popover'
family: 'feedback'
contract: 'Contextual nonmodal surface with explicit focus/dismiss behavior and viewport containment.'
---

## Import and live example

{{aeliqo:example}}

## Purpose

Attach short contextual content to a trigger with an explicit open state and dismissal policy. The host chooses nonmodal or modal behavior, and the component emits a close request rather than executing an action.

## When to use it

{{aeliqo:fixture}}

## When to use a different component

Use Dialog for a blocking decision that needs a modal focus boundary. Popover keeps the surrounding task available.

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

Keep the popover inside the viewport and its trigger visible. Choose Dialog if the content cannot fit beside the current task.

## Style hooks

{{aeliqo:style-hooks}}

{{aeliqo:performance}}

## Related components

- [Tooltip](/components/feedback.tooltip/)
- [Dialog](/components/feedback.dialog/)

## Generated TypeScript declaration

{{aeliqo:declaration}}

## Version

This page documents the Aeliqo 0.5 component contract. Keep every installed
Aeliqo package on the same exact version and check the release status
before installing from the registry.
