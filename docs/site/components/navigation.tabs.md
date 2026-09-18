---
component: 'navigation.tabs'
title: 'Tabs'
family: 'navigation'
contract: 'Named panels with stable selection; automatic activation only when latency permits.'
---

## Import and live example

{{aeliqo:example}}

## Purpose

Named panels with stable selection; automatic activation only when latency permits.

## When to use it

{{aeliqo:fixture}}

## When to use a different component

Use Breadcrumb for a hierarchical location. Tabs switch among peer panels inside the current view.

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

Keep each tab label distinct at narrow widths. Ensure the selected state and keyboard focus remain visible when the tab row overflows.

## Style hooks

{{aeliqo:style-hooks}}

{{aeliqo:performance}}

## Related components

- [Breadcrumb](/components/navigation.breadcrumb/)
- [Menu](/components/navigation.menu/)

## Generated TypeScript declaration

{{aeliqo:declaration}}

## Version

Aeliqo 0.4.1.
