---
component: 'feedback.toast'
title: 'Toast'
family: 'feedback'
contract: 'Bounded transient feedback; essential errors remain persistently available elsewhere.'
---

## Import and live example

{{aeliqo:example}}

## Purpose

Announce transient feedback while `open` and optionally dismiss it after the configured duration. Important failures need a persistent home elsewhere; the toast only reports the host's result and emits a dismissal request.

## When to use it

{{aeliqo:fixture}}

## When to use a different component

Use Alert for information that belongs in the reading flow. Toast is transient feedback and should not be the only record of a result.

## Properties and defaults

{{aeliqo:properties}}

## Events

{{aeliqo:events}}

## States and failure handling

Relevant states:

{{aeliqo:states}}

{{aeliqo:outcome}}

Set `duration` to zero for a notification that remains visible until the host
or user dismisses it. Timed notifications are capped at 60 seconds; a
`danger` tone never dismisses on the timer. Keep a durable status or error
elsewhere if a user may need to read or act on it after the toast closes.

## Keyboard, focus, and accessibility

Keyboard behavior:

{{aeliqo:keyboard}}

Exposed semantics:

{{aeliqo:semantics}}

## Responsive behavior

Allow long messages to wrap within the available width. Place transient feedback where it does not cover fixed task controls.

## Style hooks

{{aeliqo:style-hooks}}

{{aeliqo:performance}}

## Related components

- [Alert](/components/feedback.alert/)
- [EmptyState](/components/feedback.empty-state/)

## Generated TypeScript declaration

{{aeliqo:declaration}}

## Version

This page documents the unreleased 0.5.0 candidate source. The stable npm
release remains 0.4.2; candidate API and behavior details here are not a
guarantee of availability in the stable release.
