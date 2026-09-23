---
component: 'input.combobox'
title: 'Combobox'
family: 'input'
contract: 'Searchable choice with APG behavior; stale remote options cannot overwrite current input.'
---

## Import and live example

{{aeliqo:example}}

## Purpose

Keep a typed query separate from a committed option value. The component filters a supplied bounded option list locally or calls an optional `optionsLoader`, cancels superseded loads, and ignores late responses before they can replace the current suggestions.

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

With a static `options` array, the component filters the bounded list as the
query changes. `optionsLoader(query, signal)` is the optional remote path: the
host implements the request and its authorization, while the component aborts
the previous load and ignores an older completion. It accepts at most 500
options. A current loader failure leaves the field visible and reports
“Options could not be loaded”; it does not commit a different value. The
`minQueryLength` threshold prevents a load until enough characters are typed.

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

This page documents the 0.5.0 component contract. Keep every installed
Aeliqo package on the same exact version and check the release status
before installing from the registry.
