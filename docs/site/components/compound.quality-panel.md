---
component: 'compound.quality-panel'
title: 'QualityPanel'
family: 'compound'
contract: 'Source, freshness, completeness, provenance and unsupported claims displayed honestly.'
---

## Import and live example

{{aeliqo:example}}

## Purpose

Source, freshness, completeness, provenance and unsupported claims displayed honestly.

## When to use it

{{aeliqo:fixture}}

## When to use a different component

Use Alert for one warning. QualityPanel summarizes source, freshness, completeness, and provenance while keeping unsupported claims visible.

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

Let provenance and unsupported claims wrap inside the panel. Keep freshness and completeness labels visible before the evidence.

## Style hooks

{{aeliqo:style-hooks}}

{{aeliqo:performance}}

## Related components

- [Table](/components/data.table/)
- [Alert](/components/feedback.alert/)

## Generated TypeScript declaration

{{aeliqo:declaration}}

## Version

This page documents the unreleased 0.5.0 candidate source. The stable npm
release remains 0.4.2; candidate API and behavior details here are not a
guarantee of availability in the stable release.
