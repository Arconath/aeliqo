---
component: 'compound.comparison'
title: 'Comparison'
family: 'compound'
contract: 'A stable compare-set with compatible metrics and simultaneous comparison affordances.'
---

## Import and live example

{{aeliqo:example}}

## Purpose

Comparison places a bounded set of entities side by side in a table of supplied metrics. The application
declares whether units and grain are compatible; changing the compare set emits a proposal and does not
recalculate metric values.

## When to use it

{{aeliqo:fixture}}

## When to use a different component

Use Breakdown to compare groups rather than selected entities. Use Table when people need to inspect the underlying records.

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

Keep every compared entity and metric in view. Stack comparison rows or allow a local scroll area instead of dropping values.

## Style hooks

{{aeliqo:style-hooks}}

{{aeliqo:performance}}

## Related components

- [Breakdown](/components/compound.breakdown/)
- [Table](/components/data.table/)

## Generated TypeScript declaration

{{aeliqo:declaration}}

## Version

This page documents the unreleased 0.5.0 candidate source. The stable npm
release remains 0.4.2; candidate API and behavior details here are not a
guarantee of availability in the stable release.
