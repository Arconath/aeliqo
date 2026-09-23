---
component: 'foundation.grid'
title: 'Grid'
family: 'foundation'
contract: 'Arrange responsive regions without changing semantic/focus order.'
---

## Import and live example

{{aeliqo:example}}

## Purpose

Place slotted children in the declared CSS grid without changing their DOM or focus order. `columns` and `minItem` control when the layout can fit another column; the children keep their own semantics.

## When to use it

{{aeliqo:fixture}}

## When to use a different component

Use Stack for a single row or column. Grid is for items that need repeatable columns.

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

The item minimum controls how many columns fit. Check the smallest supported width before raising that minimum.

## Style hooks

{{aeliqo:style-hooks}}

{{aeliqo:performance}}

## Related components

- [Stack](/components/foundation.stack/)
- [SplitPane](/components/foundation.split-pane/)

## Generated TypeScript declaration

{{aeliqo:declaration}}

## Version

This page documents the unreleased 0.5.0 candidate source. The stable npm
release remains 0.4.2; candidate API and behavior details here are not a
guarantee of availability in the stable release.
