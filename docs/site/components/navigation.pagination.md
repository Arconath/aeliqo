---
component: 'navigation.pagination'
title: 'Pagination'
family: 'navigation'
contract: 'Stable cursor/page scope; loaded rows are not misrepresented as global selection.'
---

## Import and live example

{{aeliqo:example}}

## Purpose

Show the current page and available previous or next directions from host-supplied page information. Activating a control requests a page change; it does not fetch rows or claim that an unknown total is complete.

## When to use it

{{aeliqo:fixture}}

## When to use a different component

Use Table when the task is comparing records in columns. Pagination requests another bounded page from the host.

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

Keep page controls large enough to operate. Use the host to reduce the number of visible page links on narrow screens without hiding the current page.

## Style hooks

{{aeliqo:style-hooks}}

{{aeliqo:performance}}

## Related components

- [Table](/components/data.table/)
- [SearchResults](/components/compound.search-results/)

## Generated TypeScript declaration

{{aeliqo:declaration}}

## Version

This page documents the Aeliqo 0.5 component contract. Keep every installed
Aeliqo package on the same exact version and check the release status
before installing from the registry.
