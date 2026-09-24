---
component: 'input.search-field'
title: 'SearchField'
family: 'input'
contract: 'Explicit/debounced query policy; composition input is not submitted mid-IME.'
---

## Import and live example

{{aeliqo:example}}

## Purpose

Add an explicit query-commit policy to a text field. Enter or `submitQuery()` emits a search request; `queryOnInput` can debounce typing, while IME composition suppresses premature requests.

## When to use it

{{aeliqo:fixture}}

## When to use a different component

Use Combobox when the query selects from known entities. SearchField leaves query interpretation and execution with the host.

## Properties and defaults

{{aeliqo:properties}}

## Events

{{aeliqo:events}}

## States and failure handling

Relevant states:

{{aeliqo:states}}

{{aeliqo:outcome}}

The default `queryOnInput` value is false. When enabled, `debounceMs` is
clamped to 0–10,000 milliseconds (250 by default); a host-driven value change
or disconnection cancels a pending timer. The component emits a query
proposal, never performs the search or decides whether zero results means
empty data, a denied source, or a failed request.

## Keyboard, focus, and accessibility

Keyboard behavior:

{{aeliqo:keyboard}}

Exposed semantics:

{{aeliqo:semantics}}

## Responsive behavior

Let the query field use the available row width. Keep search policy and empty feedback visible when the form stacks.

## Style hooks

{{aeliqo:style-hooks}}

{{aeliqo:performance}}

## Related components

- [Combobox](/components/input.combobox/)
- [SearchResults](/components/compound.search-results/)

## Generated TypeScript declaration

{{aeliqo:declaration}}

## Version

This page documents the 0.5.0 component contract. Keep every installed
Aeliqo package on the same exact version and check the release status
before installing from the registry.
