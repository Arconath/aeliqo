---
component: 'compound.search-results'
title: 'SearchResults'
family: 'compound'
contract: 'Query state, collection, scoped result count and details with stale-result protection.'
---

## Import and live example

{{aeliqo:example}}

## Purpose

Query state, collection, scoped result count and details with stale-result protection.

## When to use it

{{aeliqo:fixture}}

## When to use a different component

Use RecordList when query revision and stale-result context are unnecessary. SearchResults keeps both revisions visible.

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

Keep query and revision state above results when detail moves below them. Show stale status with text as well as tone.

## Style hooks

{{aeliqo:style-hooks}}

{{aeliqo:performance}}

## Related components

- [SearchField](/components/input.search-field/)
- [RecordList](/components/data.record-list/)

## Generated TypeScript declaration

{{aeliqo:declaration}}

## Version

Aeliqo 0.4.1.
