---
component: 'navigation.breadcrumb'
title: 'Breadcrumb'
family: 'navigation'
contract: 'Reversible context path; approved routes and current-location semantics.'
---

## Minimal example

{{aeliqo:minimal-example}}

## Import and live example

{{aeliqo:example}}

## Purpose

Reversible context path; approved routes and current-location semantics.

## When to use it

{{aeliqo:fixture}}

## When to use a different component

Use Tabs for sibling views, not a path. Breadcrumb marks navigable ancestors and the current location.

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

Allow long path segments to wrap. Keep the current location clear when the host shortens ancestry for a small screen.

## Style hooks

{{aeliqo:style-hooks}}

{{aeliqo:performance}}

## Related components

- [Tabs](/components/navigation.tabs/)
- [TreeNav](/components/navigation.tree-nav/)

## Generated TypeScript declaration

{{aeliqo:declaration}}

## Version

Aeliqo 0.4.0.
