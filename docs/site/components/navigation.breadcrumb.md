---
component: 'navigation.breadcrumb'
title: 'Breadcrumb'
family: 'navigation'
contract: 'Reversible context path; approved routes and current-location semantics.'
---

## Import and live example

{{aeliqo:example}}

## Purpose

Show the application-supplied path to the current location as an ordered set of links. The last item marks the current page; the host supplies approved destinations rather than asking the component to infer routes.

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

This page documents the unreleased 0.5.0 candidate source. The stable npm
release remains 0.4.2; candidate API and behavior details here are not a
guarantee of availability in the stable release.
