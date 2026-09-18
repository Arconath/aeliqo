---
component: 'feedback.drawer'
title: 'Drawer'
family: 'feedback'
contract: 'Inline or modal detail according to an explicit mode; do not mix the two focus models.'
---

## Import and live example

{{aeliqo:example}}

## Purpose

Inline or modal detail according to an explicit mode; do not mix the two focus models.

## When to use it

{{aeliqo:fixture}}

## When to use a different component

Use Dialog for a blocking confirmation. Drawer is suited to detail that stays beside the current context.

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

Inline mode uses its host column; give it the full row when that column is too narrow. Choose modal mode only when a separate focus boundary is needed.

## Style hooks

{{aeliqo:style-hooks}}

{{aeliqo:performance}}

## Related components

- [Dialog](/components/feedback.dialog/)
- [Popover](/components/feedback.popover/)

## Generated TypeScript declaration

{{aeliqo:declaration}}

## Version

Aeliqo 0.4.2.
