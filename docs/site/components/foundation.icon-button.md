---
component: 'foundation.icon-button'
title: 'IconButton'
family: 'foundation'
contract: 'Named compact action with minimum target area; icon alone is never its accessible name.'
---

## Import and live example

{{aeliqo:example}}

## Purpose

Give a compact icon action a native button target and a text-based accessible name from `label`. The icon slot is visual content; the host handles the emitted action and owns any pending state.

## When to use it

{{aeliqo:fixture}}

## When to use a different component

Use Button when the action needs visible wording. Tooltip content may supplement the name, but cannot replace it.

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

The icon target keeps its minimum hit area. Separate adjacent actions so their targets and focus outlines remain distinct.

## Style hooks

{{aeliqo:style-hooks}}

{{aeliqo:performance}}

## Related components

- [Button](/components/foundation.button/)
- [Tooltip](/components/feedback.tooltip/)

## Generated TypeScript declaration

{{aeliqo:declaration}}

## Version

This page documents the 0.5.0 component contract. Keep every installed
Aeliqo package on the same exact version and check the release status
before installing from the registry.
