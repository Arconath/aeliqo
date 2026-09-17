---
component: 'compound.breakdown'
title: 'Breakdown'
family: 'compound'
contract: 'Group a declared metric and inspect contributing records; recompute ratios from sufficient statistics.'
---

## Minimal example

{{aeliqo:minimal-example}}

## Import and live example

{{aeliqo:example}}

## Purpose

Group a declared metric and inspect contributing records; recompute ratios from sufficient statistics.

## When to use it

{{aeliqo:fixture}}

## When to use a different component

Use Comparison for a fixed set of entities. Breakdown groups an authorized record set by a declared key.

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

Aeliqo 0.4.0.
