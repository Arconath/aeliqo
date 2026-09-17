---
component: 'feedback.empty-state'
title: 'EmptyState'
family: 'feedback'
contract: 'Distinguish no records, no matches, forbidden data, loading and failure.'
---

## Minimal example

{{aeliqo:minimal-example}}

## Import and live example

{{aeliqo:example}}

## Purpose

Distinguish no records, no matches, forbidden data, loading and failure.

## When to use it

{{aeliqo:fixture}}

## When to use a different component

Use Alert for a warning when data is available. EmptyState describes a valid absence of results and offers recovery.

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

Keep the recovery action visible when the page narrows. Let the explanation wrap within the host column.

## Style hooks

{{aeliqo:style-hooks}}

{{aeliqo:performance}}

## Related components

- [Alert](/components/feedback.alert/)
- [Skeleton](/components/feedback.skeleton/)

## Generated TypeScript declaration

{{aeliqo:declaration}}

## Version

Aeliqo 0.4.0.
