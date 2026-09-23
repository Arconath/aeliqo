---
component: 'compound.investigation'
title: 'Investigation'
family: 'compound'
contract: 'Trend, baseline, event timeline and detail; associations never imply causes.'
---

## Import and live example

{{aeliqo:example}}

## Purpose

Investigation brings a supplied trend, baseline metric, event timeline, and selected detail into one
scope. The application binds each Result and dataset; missing trend or event evidence gets an explicit
message, and the view warns that association is not causation.

## When to use it

{{aeliqo:fixture}}

## When to use a different component

Use Explorer for routine browse, filter, and selection work. Investigation keeps baseline, trend evidence, and detail in one declared scope.

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

Stack baseline, evidence, and detail in reading order. Avoid separate horizontal panels that hide the shared scope.

## Style hooks

{{aeliqo:style-hooks}}

{{aeliqo:performance}}

## Related components

- [Explorer](/components/compound.explorer/)
- [SearchResults](/components/compound.search-results/)

## Generated TypeScript declaration

{{aeliqo:declaration}}

## Version

This page documents the 0.5.0 component contract. Keep every installed
Aeliqo package on the same exact version and check the release status
before installing from the registry.
