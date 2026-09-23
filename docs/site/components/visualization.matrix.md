---
component: 'visualization.matrix'
title: 'Matrix'
family: 'visualization'
contract: 'Entity-feature comparison preserving row/column association and useful comparison at narrow width.'
---

## Import and live example

{{aeliqo:example}}

## Purpose

Matrix preserves row-to-column associations in a tabular view of supplied Result fields. Exact values and
selection remain available in the data table, including when the layout narrows; it does not infer a time
axis or aggregate the cells.

## When to use it

{{aeliqo:fixture}}

## When to use a different component

Use Heatmap when color encodes a value across two categories. Matrix keeps supplied rows, columns, and exact values in table form.

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

This page documents the 0.5.0 component contract. Keep every installed
Aeliqo package on the same exact version and check the release status
before installing from the registry.
