---
component: 'compound.quality-panel'
title: 'QualityPanel'
family: 'compound'
contract: 'Source, freshness, completeness, provenance and unsupported claims displayed honestly.'
---

## Import and live example

{{aeliqo:example}}

## Purpose

QualityPanel reports application-supplied source, freshness, completeness, provenance, and unsupported
claims. It labels missing metadata as not supplied and lists unsupported claims separately; it does not
independently verify the data source.

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

This page documents the 0.5.0 component contract. Keep every installed
Aeliqo package on the same exact version and check the release status
before installing from the registry.
