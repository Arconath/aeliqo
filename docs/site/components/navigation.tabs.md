---
component: 'navigation.tabs'
title: 'Tabs'
family: 'navigation'
contract: 'Named panels with stable selection; automatic activation only when latency permits.'
---

## Import and live example

{{aeliqo:example}}

## Purpose

Connect named tabs to panels with one selected value. Automatic activation selects as arrow-key focus moves; `activation='manual'` waits for Enter or Space, which is useful when changing panels starts costly work.

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

This page documents the unreleased 0.5.0 candidate source. The stable npm
release remains 0.4.2; candidate API and behavior details here are not a
guarantee of availability in the stable release.
