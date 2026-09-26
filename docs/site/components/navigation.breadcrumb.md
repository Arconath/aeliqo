---
component: 'navigation.breadcrumb'
title: 'Breadcrumb'
family: 'navigation'
contract: 'Reversible context path; approved routes and current-location semantics.'
---

## Import and live example

{{aeliqo:fixture}}

{{aeliqo:example}}

## Purpose

Shows the path to the current page as an ordered list of links. You supply the approved destinations; the last item marks the current location.

## When to use it

- Pages nested under parents, like Reports → Weekly report.
- Letting users jump back up the hierarchy.
- Marking the current location inside a navigable trail.

## When to use a different component

- Use Tabs to switch between sibling views, not a path.
- Use TreeNav for a hierarchy users expand and browse.

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

This page documents the Aeliqo 0.5 component contract. Keep every installed
Aeliqo package on the same exact version and check the release status
before installing from the registry.
