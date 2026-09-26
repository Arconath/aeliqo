---
component: 'visualization.relationship'
title: 'Relationship'
family: 'visualization'
contract: 'Declared edges/cardinality only; deterministic bounded layout with accessible adjacency view.'
---

## Import and live example

{{aeliqo:fixture}}

{{aeliqo:example}}

## Purpose

Draw declared edges between entities as a graph. An adjacency-style data view keeps labels and selection reachable.

## When to use it

- Show declared connections such as reports-to or depends-on.
- Preserve edge direction and count from the supplied data.
- Reach the same edges through an adjacency view when the graph is crowded.

## When to use a different component

- Use Tree for a strict parent-child hierarchy.
- Use Scatter for two numeric axes; point position implies no link.

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

This page documents the Aeliqo 0.5 component contract. Keep every installed
Aeliqo package on the same exact version and check the release status
before installing from the registry.
