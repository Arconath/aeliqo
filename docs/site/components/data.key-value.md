---
component: 'data.key-value'
title: 'KeyValue'
family: 'data'
contract: 'Labeled facts with stable ordering, wrapping and semantic links.'
---

## Import and live example

{{aeliqo:example}}

## Purpose

KeyValue renders an ordered set of application-supplied facts as a definition list. Each item can include
a description or a safe link, and the component reports scope and loading or failure states without
fetching facts itself.

## When to use it

{{aeliqo:fixture}}

## When to use a different component

Use Detail for a selected record with field definitions. KeyValue is a short ordered list of facts.

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

Allow definition-list labels and values to wrap in reading order. Keep each label adjacent to its value.

## Style hooks

{{aeliqo:style-hooks}}

{{aeliqo:performance}}

## Related components

- [Detail](/components/data.detail/)
- [RecordList](/components/data.record-list/)

## Generated TypeScript declaration

{{aeliqo:declaration}}

## Version

This page documents the Aeliqo 0.5 component contract. Keep every installed
Aeliqo package on the same exact version and check the release status
before installing from the registry.
