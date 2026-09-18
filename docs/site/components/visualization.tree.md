---
component: 'visualization.tree'
title: 'Tree'
family: 'visualization'
contract: 'Explicit hierarchy, cycle validation, stable expansion and equivalent text navigation.'
---

## Import and live example

{{aeliqo:example}}

## Purpose

Explicit hierarchy, cycle validation, stable expansion and equivalent text navigation.

## When to use it

{{aeliqo:fixture}}

## When to use a different component

Use Relationship for general directed edges. Tree requires explicit parent identity.

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

The hierarchy viewport can scroll inside its host. Bound marks and keep parent labels available when the layout narrows.

## Style hooks

{{aeliqo:style-hooks}}

{{aeliqo:performance}}

## Related components

- [Treemap](/components/visualization.treemap/)
- [Relationship](/components/visualization.relationship/)

## Generated TypeScript declaration

{{aeliqo:declaration}}

## Version

Aeliqo 0.4.1.
