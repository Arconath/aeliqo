---
component: 'feedback.empty-state'
title: 'EmptyState'
family: 'feedback'
contract: 'Distinguish no records, no matches, forbidden data, loading and failure.'
---

## Import and live example

{{aeliqo:example}}

## Purpose

Explain why a result area has no content using an explicit kind, heading, and message. An optional recovery button proposes a host action such as clearing filters; it does not fabricate rows or retry data access itself.

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

This page documents the unreleased 0.5.0 candidate source. The stable npm
release remains 0.4.2; candidate API and behavior details here are not a
guarantee of availability in the stable release.
