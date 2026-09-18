---
component: 'navigation.pagination'
title: 'Pagination'
family: 'navigation'
contract: 'Stable cursor/page scope; loaded rows are not misrepresented as global selection.'
---

## Import and live example

{{aeliqo:example}}

## Purpose

Stable cursor/page scope; loaded rows are not misrepresented as global selection.

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

Aeliqo 0.4.2.
