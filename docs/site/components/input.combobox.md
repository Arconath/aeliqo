---
component: 'input.combobox'
title: 'Combobox'
family: 'input'
contract: 'Searchable choice with APG behavior; stale remote options cannot overwrite current input.'
---

## Import and live example

{{aeliqo:example}}

## Purpose

Searchable choice with APG behavior; stale remote options cannot overwrite current input.

## When to use it

{{aeliqo:fixture}}

## When to use a different component

Use Select for a short list that needs no query. Use SearchField when the query itself is the value and no option is selected.

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

Keep the query draft and selected value distinct at narrow widths. Test long option names against the visible viewport.

## Style hooks

{{aeliqo:style-hooks}}

{{aeliqo:performance}}

## Related components

- [Select](/components/input.select/)
- [SearchField](/components/input.search-field/)

## Generated TypeScript declaration

{{aeliqo:declaration}}

## Version

This page documents the unreleased 0.5.0 candidate source. The stable npm
release remains 0.4.2; candidate API and behavior details here are not a
guarantee of availability in the stable release.
