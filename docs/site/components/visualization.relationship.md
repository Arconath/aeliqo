---
component: 'visualization.relationship'
title: 'Relationship'
family: 'visualization'
contract: 'Declared edges/cardinality only; deterministic bounded layout with accessible adjacency view.'
---

## Import and live example

{{aeliqo:example}}

## Purpose

Relationship draws the directed edges explicitly declared in a bound visualization. The application
supplies source, target, and cardinality meaning; an adjacency-style data view preserves edge labels and
keyboard selection when the graphic is crowded or unavailable.

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

This page documents the unreleased 0.5.0 candidate source. The stable npm
release remains 0.4.2; candidate API and behavior details here are not a
guarantee of availability in the stable release.
