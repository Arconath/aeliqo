---
component: 'foundation.button'
title: 'Button'
family: 'foundation'
contract: 'Trigger one explicit action; native button semantics; disabled and pending never double-submit.'
---

## Import and live example

{{aeliqo:example}}

## Purpose

Render a native button for one host-owned action. `disabled` and `pending` block activation; the component emits a cancellable action proposal, while the application performs the work and clears `pending` after its result.

## When to use it

{{aeliqo:fixture}}

## When to use a different component

Use Link when activation navigates. Choose IconButton only for a compact icon action that still has its own accessible name.

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

Its target keeps the component minimum hit area. Give long action labels a full row in narrow forms and leave room for the focus outline.

## Style hooks

{{aeliqo:style-hooks}}

{{aeliqo:performance}}

## Related components

- [IconButton](/components/foundation.icon-button/)
- [Link](/components/foundation.link/)

## Generated TypeScript declaration

{{aeliqo:declaration}}

## Version

This page documents the unreleased 0.5.0 candidate source. The stable npm
release remains 0.4.2; candidate API and behavior details here are not a
guarantee of availability in the stable release.
