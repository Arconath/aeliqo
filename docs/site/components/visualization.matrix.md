---
component: 'visualization.matrix'
title: 'Matrix'
family: 'visualization'
contract: 'Entity-feature comparison preserving row/column association and useful comparison at narrow width.'
---

## Minimal example

{{aeliqo:minimal-example}}

## Import and live example

{{aeliqo:example}}

## Purpose

Entity-feature comparison preserving row/column association and useful comparison at narrow width.

## When to use it

{{aeliqo:fixture}}

## When to use a different component

Use Heatmap when color encodes a value across two categories. Matrix keeps temporal dimensions and values in table form.

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

Aeliqo 0.4.0.
