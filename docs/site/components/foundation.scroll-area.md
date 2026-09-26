---
component: 'foundation.scroll-area'
title: 'ScrollArea'
family: 'foundation'
contract: 'Preserve native scrolling, focus visibility, zoom and platform affordances.'
---

## Import and live example

{{aeliqo:example}}

## Purpose

Wrap long content in a native scroll viewport with an application-supplied label. Its `axis` and `tabIndex` determine which directions scroll and whether keyboard users can enter the region; child focus order remains intact.

## When to use it

{{aeliqo:fixture}}

## When to use a different component

Use normal page scrolling when the whole page should move. ScrollArea is for a labelled region with its own bounded overflow.

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

Bound its height only when independent scrolling is needed. Keep enough visible space for keyboard scrolling at high zoom.

## Style hooks

{{aeliqo:style-hooks}}

{{aeliqo:performance}}

## Related components

- [SplitPane](/components/foundation.split-pane/)
- [Surface](/components/foundation.surface/)

## Generated TypeScript declaration

{{aeliqo:declaration}}

## Version

This page documents the Aeliqo 0.5 component contract. Keep every installed
Aeliqo package on the same exact version and check the release status
before installing from the registry.
