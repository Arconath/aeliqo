---
component: 'data.card-collection'
title: 'CardCollection'
family: 'data'
contract: 'Repeated compact records; preserve reading order, headings and bounded loading.'
---

## Import and live example

{{aeliqo:example}}

## Purpose

Repeated compact records; preserve reading order, headings and bounded loading.

## When to use it

{{aeliqo:fixture}}

## When to use a different component

Use RecordList for a compact selection list or Table for column comparison. Cards suit a visual summary of each record.

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

Cards adapt to available width. Let field values wrap and keep each selection control reachable.

## Style hooks

{{aeliqo:style-hooks}}

{{aeliqo:performance}}

## Related components

- [RecordList](/components/data.record-list/)
- [Table](/components/data.table/)

## Generated TypeScript declaration

{{aeliqo:declaration}}

## Version

This page documents the unreleased 0.5.0 candidate source. The stable npm
release remains 0.4.2; candidate API and behavior details here are not a
guarantee of availability in the stable release.
