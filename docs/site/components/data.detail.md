---
component: 'data.detail'
title: 'Detail'
family: 'data'
contract: 'Selected entity facts including missing fields; record identity persists across views.'
---

## Import and live example

{{aeliqo:example}}

## Purpose

Detail shows the fields of one application-supplied record as labeled facts. It can expose the record
identity and uses a visible missing-value label, while selection and record lookup stay with the
application.

## When to use it

{{aeliqo:fixture}}

## When to use a different component

Use KeyValue for a compact group of facts without record identity. Detail makes the selected record and missing fields explicit.

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

Long field values wrap within the detail region. Keep record identity visible when the host moves detail below the list.

## Style hooks

{{aeliqo:style-hooks}}

{{aeliqo:performance}}

## Related components

- [KeyValue](/components/data.key-value/)
- [RecordEditor](/components/compound.record-editor/)

## Generated TypeScript declaration

{{aeliqo:declaration}}

## Version

This page documents the unreleased 0.5.0 candidate source. The stable npm
release remains 0.4.2; candidate API and behavior details here are not a
guarantee of availability in the stable release.
