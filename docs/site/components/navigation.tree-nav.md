---
component: 'navigation.tree-nav'
title: 'TreeNav'
family: 'navigation'
contract: 'Hierarchical navigation with stable node identities, expansion and keyboard semantics.'
---

## Import and live example

{{aeliqo:example}}

## Purpose

Show a bounded hierarchy of identified navigation nodes with tree keyboard semantics. The component validates node IDs and structure, tracks expanded branches locally, and emits selection or expansion events for the host to coordinate with routing.

## When to use it

{{aeliqo:fixture}}

## When to use a different component

Use Breadcrumb for a short path with one current location. TreeNav suits hierarchical sections with expansion and selection.

## Properties and defaults

{{aeliqo:properties}}

## Events

{{aeliqo:events}}

## States and failure handling

Relevant states:

{{aeliqo:states}}

{{aeliqo:outcome}}

Node IDs must be unique, nonempty strings of at most 160 characters. Cycles,
invalid node shapes, duplicate IDs, and more than 512 nodes produce a visible
status message in place of the tree. `expandedIds` synchronizes the initial
or externally updated expansion set; after an uncancelled expand event, this
element also updates its local expansion state. After an uncancelled selection
event it updates `selectedId`. The host should observe those events to keep
routing and application state aligned, and can pass new props to reconcile
the tree with an external navigation change.

## Keyboard, focus, and accessibility

Keyboard behavior:

{{aeliqo:keyboard}}

Exposed semantics:

{{aeliqo:semantics}}

## Responsive behavior

Allow long node labels to wrap inside the tree. Keep the selected item and expansion state visible after the host narrows the panel.

## Style hooks

{{aeliqo:style-hooks}}

{{aeliqo:performance}}

## Related components

- [Menu](/components/navigation.menu/)
- [Breadcrumb](/components/navigation.breadcrumb/)

## Generated TypeScript declaration

{{aeliqo:declaration}}

## Version

This page documents the Aeliqo 0.5 component contract. Keep every installed
Aeliqo package on the same exact version and check the release status
before installing from the registry.
