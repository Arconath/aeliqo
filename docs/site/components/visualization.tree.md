---
component: 'visualization.tree'
title: 'Tree'
family: 'visualization'
contract: 'Explicit hierarchy, cycle validation, stable expansion and equivalent text navigation.'
---

## Import and live example

{{aeliqo:fixture}}

{{aeliqo:example}}

## Purpose

Show a declared parent-child hierarchy as a tree. A structured data view keeps every node reachable without the graphic.

## When to use it

- Show org charts or nested categories with declared parents.
- Let people expand levels while selection stays stable.
- Offer a text outline when the graphic is too dense.

## When to use a different component

- Use Treemap when area should encode a value.
- Use Relationship for directed edges that are not strict parent-child.

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

This page documents the Aeliqo 0.5 component contract. Keep every installed
Aeliqo package on the same exact version and check the release status
before installing from the registry.
