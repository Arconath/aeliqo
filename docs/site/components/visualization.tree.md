---
component: 'visualization.tree'
title: 'Tree'
family: 'visualization'
contract: 'Explicit hierarchy, cycle validation, stable expansion and equivalent text navigation.'
---

## Import and live example

{{aeliqo:example}}

## Purpose

Tree presents a declared parent-child hierarchy from authorized rows. The bound geometry validates the
hierarchy and limits graphic complexity; a structured data view keeps node labels and selection reachable
when the graphic cannot be shown.

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

This page documents the unreleased 0.5.0 candidate source. The stable npm
release remains 0.4.2; candidate API and behavior details here are not a
guarantee of availability in the stable release.
