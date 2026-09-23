---
component: 'visualization.treemap'
title: 'Treemap'
family: 'visualization'
contract: 'Nonnegative additive hierarchy; area meaning and tiny-node access preserved.'
---

## Import and live example

{{aeliqo:example}}

## Purpose

Nonnegative additive hierarchy; area meaning and tiny-node access preserved.

## When to use it

{{aeliqo:fixture}}

## When to use a different component

Use Tree when parent labels and paths matter more than area. Treemap sizes marks only with an explicit value meaning.

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

This page documents the unreleased 0.5.0 candidate source. The stable npm
release remains 0.4.2; candidate API and behavior details here are not a
guarantee of availability in the stable release.
