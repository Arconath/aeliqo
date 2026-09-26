---
component: 'visualization.treemap'
title: 'Treemap'
family: 'visualization'
contract: 'Nonnegative additive hierarchy; area meaning and tiny-node access preserved.'
---

## Import and live example

{{aeliqo:fixture}}

{{aeliqo:example}}

## Purpose

Show a hierarchy as nested rectangles sized by a nonnegative measure. Tiny nodes stay reachable through the data view.

## When to use it

- Compare part-to-whole size across a hierarchy.
- Show breakdowns where areas must add up, like budgets.
- Keep tiny nodes reachable through the data view.

## When to use a different component

- Use Tree when labels and structure matter more than area.
- Use Heatmap for two flat dimensions instead of nested areas.

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

The treemap viewport can scroll inside its host. Keep its accessible data view reachable when labels no longer fit inside marks.

## Style hooks

{{aeliqo:style-hooks}}

{{aeliqo:performance}}

## Related components

- [Tree](/components/visualization.tree/)
- [Heatmap](/components/visualization.heatmap/)

## Generated TypeScript declaration

{{aeliqo:declaration}}

## Version

This page documents the Aeliqo 0.5 component contract. Keep every installed
Aeliqo package on the same exact version and check the release status
before installing from the registry.
