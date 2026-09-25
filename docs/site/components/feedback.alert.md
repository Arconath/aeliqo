---
component: 'feedback.alert'
title: 'Alert'
family: 'feedback'
contract: 'Persistent status/error with severity semantics and actionable recovery.'
---

## Import and live example

{{aeliqo:example}}

## Purpose

Keep a status or warning visible with its heading and message until the host changes it. Optional action and dismiss buttons emit separate proposals; tone supplements the text rather than carrying the message alone.

## When to use it

{{aeliqo:fixture}}

## When to use a different component

Use Toast for a brief non-blocking confirmation. Keep warnings and actionable messages in the page with Alert.

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

Let the message and its actions wrap together. Keep dismissal available without separating it from the alert content.

## Style hooks

{{aeliqo:style-hooks}}

{{aeliqo:performance}}

## Related components

- [Toast](/components/feedback.toast/)
- [EmptyState](/components/feedback.empty-state/)

## Generated TypeScript declaration

{{aeliqo:declaration}}

## Version

This page documents the Aeliqo 0.5 component contract. Keep every installed
Aeliqo package on the same exact version and check the release status
before installing from the registry.
