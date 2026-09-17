---
component: 'feedback.toast'
title: 'Toast'
family: 'feedback'
contract: 'Bounded transient feedback; essential errors remain persistently available elsewhere.'
---

## Minimal example

{{aeliqo:minimal-example}}

## Import and live example

{{aeliqo:example}}

## Purpose

Bounded transient feedback; essential errors remain persistently available elsewhere.

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

Aeliqo 0.4.0.
