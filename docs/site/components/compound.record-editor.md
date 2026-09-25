---
component: 'compound.record-editor'
title: 'RecordEditor'
family: 'compound'
contract: 'Existing primitive form over a host-owned action with entity revision and explicit save/cancel.'
---

## Import and live example

{{aeliqo:example}}

## Purpose

RecordEditor wraps slotted form controls around a record identity and revision. Save checks control
validity and emits a host-action proposal with current values; Cancel emits the same record context
without saving. The application owns the effect and conflict handling.

## When to use it

{{aeliqo:fixture}}

## When to use a different component

Use Form for a general submission flow. RecordEditor includes record identity and revision in host-authorized save and cancel requests.

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

Stack fields at narrow widths. Keep the entity identity and revision associated with Save and Cancel.

## Style hooks

{{aeliqo:style-hooks}}

{{aeliqo:performance}}

## Related components

- [Form](/components/input.form/)
- [Detail](/components/data.detail/)

## Generated TypeScript declaration

{{aeliqo:declaration}}

## Version

This page documents the Aeliqo 0.5 component contract. Keep every installed
Aeliqo package on the same exact version and check the release status
before installing from the registry.
