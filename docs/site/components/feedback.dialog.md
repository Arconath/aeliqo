---
component: 'feedback.dialog'
title: 'Dialog'
family: 'feedback'
contract: 'Native-first modal semantics, focus containment/return and escape policy.'
---

## Import and live example

{{aeliqo:example}}

## Purpose

Place a labelled interruption in a native dialog and contain focus while modal. Escape and the close button use the configured dismissal policy and emit a close request; the host owns the consequential action inside it.

## When to use it

{{aeliqo:fixture}}

## When to use a different component

Use Drawer for contextual detail that should sit beside the current page. Dialog is for modal interruption and confirmation.

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

Keep modal actions reachable within the viewport. Let long content scroll without covering the close or confirmation controls.

## Style hooks

{{aeliqo:style-hooks}}

{{aeliqo:performance}}

## Related components

- [Drawer](/components/feedback.drawer/)
- [Alert](/components/feedback.alert/)

## Generated TypeScript declaration

{{aeliqo:declaration}}

## Version

This page documents the Aeliqo 0.5 component contract. Keep every installed
Aeliqo package on the same exact version and check the release status
before installing from the registry.
