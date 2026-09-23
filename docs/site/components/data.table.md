---
component: 'data.table'
title: 'Table'
family: 'data'
contract: 'Native table first; separate interactive-grid mode; sorting, paging, selection, virtualization and precise values.'
---

## Import and live example

{{aeliqo:example}}

## Purpose

Table keeps row and column relationships explicit with a native table by default; interactive grid mode
is a separate choice for cell navigation. Sorting, paging, selection, and virtual-window events are
requests. The application updates rows, Result evidence, and controlled state after handling each
request.

## When to use it

{{aeliqo:fixture}}

## When to use a different component

Use RecordList when selection and compact browsing are the main task. Table suits column comparison and sorting.

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

Use the table’s bounded page or virtualization controls with wide data. Keep a scroll path or choose a compact view before labels become unreadable.

## Style hooks

{{aeliqo:style-hooks}}

{{aeliqo:performance}}

## Related components

- [RecordList](/components/data.record-list/)
- [SelectionSummary](/components/data.selection-summary/)

## Generated TypeScript declaration

{{aeliqo:declaration}}

## Version

This page documents the unreleased 0.5.0 candidate source. The stable npm
release remains 0.4.2; candidate API and behavior details here are not a
guarantee of availability in the stable release.
