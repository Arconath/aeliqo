---
component: 'navigation.menu'
title: 'Menu'
family: 'navigation'
contract: 'Action menu with focus return and keyboard behavior; no layout-generated business actions.'
---

## Import and live example

{{aeliqo:example}}

## Purpose

Show a bounded list of application-supplied actions with roving keyboard focus. Selecting an enabled item emits its ID; the host performs the action and decides how open state changes.

## When to use it

{{aeliqo:fixture}}

## When to use a different component

Use Popover for details or non-command content. Menu is for a short list of explicit commands.

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

Keep the menu within the visible viewport and its commands keyboard reachable. Avoid relying on hover to expose actions.

## Style hooks

{{aeliqo:style-hooks}}

{{aeliqo:performance}}

## Related components

- [TreeNav](/components/navigation.tree-nav/)
- [Popover](/components/feedback.popover/)

## Generated TypeScript declaration

{{aeliqo:declaration}}

## Version

This page documents the Aeliqo 0.5 component contract. Keep every installed
Aeliqo package on the same exact version and check the release status
before installing from the registry.
