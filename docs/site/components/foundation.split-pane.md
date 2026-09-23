---
component: 'foundation.split-pane'
title: 'SplitPane'
family: 'foundation'
contract: 'Resize adjacent regions by pointer and keyboard while respecting minimum task requirements.'
---

## Import and live example

{{aeliqo:example}}

## Purpose

Arrange two slotted panes around a resizable separator with bounded `min`, `max`, and `step` values. Pointer and keyboard changes emit a position proposal; use `position` for controlled layout or `defaultPosition` for initial local state.

## When to use it

{{aeliqo:fixture}}

## When to use a different component

Use Grid for a fixed responsive layout. SplitPane is for panes that users can resize.

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

Set pane limits so each side stays useful. On phones, use vertical orientation if two side-by-side panes become too narrow.

## Style hooks

{{aeliqo:style-hooks}}

{{aeliqo:performance}}

## Related components

- [ScrollArea](/components/foundation.scroll-area/)
- [Grid](/components/foundation.grid/)

## Generated TypeScript declaration

{{aeliqo:declaration}}

## Version

This page documents the unreleased 0.5.0 candidate source. The stable npm
release remains 0.4.2; candidate API and behavior details here are not a
guarantee of availability in the stable release.
