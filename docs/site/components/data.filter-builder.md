---
component: 'data.filter-builder'
title: 'FilterBuilder'
family: 'data'
contract: 'Typed predicates, AND/OR/null handling, visible inherited scope and explicit query application.'
---

## Import and live example

{{aeliqo:example}}

## Purpose

Typed predicates, AND/OR/null handling, visible inherited scope and explicit query application.

## When to use it

{{aeliqo:fixture}}

## When to use a different component

Use SelectionSummary to report the active selection. FilterBuilder edits predicates and applies them only after an explicit request.

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

Stack field, operator, and value controls when space is limited. Keep Apply reachable and preserve the active draft.

## Style hooks

{{aeliqo:style-hooks}}

{{aeliqo:performance}}

## Related components

- [SelectionSummary](/components/data.selection-summary/)
- [Table](/components/data.table/)

## Generated TypeScript declaration

{{aeliqo:declaration}}

## Version

This page documents the unreleased 0.5.0 candidate source. The stable npm
release remains 0.4.2; candidate API and behavior details here are not a
guarantee of availability in the stable release.
