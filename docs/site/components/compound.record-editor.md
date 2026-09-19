---
component: 'compound.record-editor'
title: 'RecordEditor'
family: 'compound'
contract: 'Existing primitive form over a host-owned action with entity revision and explicit save/cancel.'
---

## Import and live example

{{aeliqo:example}}

## Purpose

Existing primitive form over a host-owned action with entity revision and explicit save/cancel.

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

Aeliqo 0.4.2.
