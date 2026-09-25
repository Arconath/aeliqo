---
component: 'data.card-collection'
title: 'CardCollection'
family: 'data'
contract: 'Repeated compact records; preserve reading order, headings and bounded loading.'
---

## Import and live example

{{aeliqo:example}}

## Purpose

CardCollection presents supplied records as cards with a heading and optional fields in reading order.
Selection buttons emit stable identity proposals, and Load more requests another window; the application
remains responsible for fetching rows and updating selected keys.

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

This page documents the Aeliqo 0.5 component contract. Keep every installed
Aeliqo package on the same exact version and check the release status
before installing from the registry.
