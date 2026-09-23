---
component: 'compound.breakdown'
title: 'Breakdown'
family: 'compound'
contract: 'Display host-prepared group metrics and contributing records; group selection is a host request.'
---

## Import and live example

{{aeliqo:example}}

## Purpose

Breakdown shows application-supplied group metrics and optional contributing records. Selecting a group
emits its key so the application can load or update the record window; this component displays provided
values and never computes a ratio or regrouping itself.

## When to use it

{{aeliqo:fixture}}

## When to use a different component

Use Comparison for a fixed set of entities. Breakdown displays groups and contributing records prepared by the application.

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

Keep each group label beside its value and record count. Let groups wrap as the host column narrows.

## Style hooks

{{aeliqo:style-hooks}}

{{aeliqo:performance}}

## Related components

- [Comparison](/components/compound.comparison/)
- [Metric](/components/data.metric/)

## Generated TypeScript declaration

{{aeliqo:declaration}}

## Version

This page documents the unreleased 0.5.0 candidate source. The stable npm
release remains 0.4.2; candidate API and behavior details here are not a
guarantee of availability in the stable release.
