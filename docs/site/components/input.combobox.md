---
component: 'input.combobox'
title: 'Combobox'
family: 'input'
contract: 'Searchable choice with APG behavior; stale remote options cannot overwrite current input.'
---

## Import and live example

{{aeliqo:fixture}}

{{aeliqo:example}}

## Purpose

A searchable choice field that keeps the typed query separate from the committed option. Late remote responses are ignored, so stale options never overwrite current input.

## When to use it

- People pick one option from a list too long to read at once.
- Typing a query should filter the option list.
- Options may load remotely and responses can arrive late.
- The query draft and the committed value must stay separate.

## When to use a different component

- Use [Select](/components/input.select/) for a short list that needs no query.
- Use [SearchField](/components/input.search-field/) when the query itself is the value and no option is committed.

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
host owns the request and its authorization, while the component aborts the
previous load and ignores an older completion. At most 500 options are
accepted. A loader failure keeps the field visible, reports “Options could
not be loaded”, and never commits a different value. `minQueryLength` delays
loading until enough characters are typed.

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

This page documents the Aeliqo 0.5 component contract. Keep every installed
Aeliqo package on the same exact version and check the release status
before installing from the registry.
