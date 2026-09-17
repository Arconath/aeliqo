---
component: 'visualization.relationship'
title: 'Relationship'
family: 'visualization'
contract: 'Declared edges/cardinality only; deterministic bounded layout with accessible adjacency view.'
---

## Minimal example

{{aeliqo:minimal-example}}

## Import and live example

{{aeliqo:example}}

## Purpose

Declared edges/cardinality only; deterministic bounded layout with accessible adjacency view.

## When to use it

{{aeliqo:fixture}}

## When to use a different component

Use Tree for a parent and child hierarchy. Relationship displays explicit directed edges without asserting causation.

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

The graph viewport can scroll inside its host. Keep labels and keyboard targets available when many nodes are present.

## Style hooks

{{aeliqo:style-hooks}}

{{aeliqo:performance}}

## Related components

- [Tree](/components/visualization.tree/)
- [Scatter](/components/visualization.scatter/)

## Generated TypeScript declaration

{{aeliqo:declaration}}

## Version

Aeliqo 0.4.0.
