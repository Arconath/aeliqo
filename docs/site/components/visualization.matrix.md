---
component: 'visualization.matrix'
title: 'Matrix'
family: 'visualization'
contract: 'Entity-feature comparison preserving row/column association and useful comparison at narrow width.'
---

## Import and live example

{{aeliqo:fixture}}

{{aeliqo:example}}

## Purpose

Compare records across features in a table grid. Exact values and row identity stay readable at narrow widths.

## When to use it

- Compare entities across several fields side by side.
- Keep each cell tied to its row and column.
- Show exact values rather than color-encoded cells.

## When to use a different component

- Use Heatmap when color should summarize cell values.
- Use Relationship for declared edges between entities.

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

Temporal columns may need horizontal scrolling. Keep row identity visible and let the host provide the width for readable values.

## Style hooks

{{aeliqo:style-hooks}}

{{aeliqo:performance}}

## Related components

- [Heatmap](/components/visualization.heatmap/)
- [Relationship](/components/visualization.relationship/)

## Generated TypeScript declaration

{{aeliqo:declaration}}

## Version

This page documents the Aeliqo 0.5 component contract. Keep every installed
Aeliqo package on the same exact version and check the release status
before installing from the registry.
