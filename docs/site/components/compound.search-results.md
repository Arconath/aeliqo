---
component: 'compound.search-results'
title: 'SearchResults'
family: 'compound'
contract: 'Query state, collection, scoped result count and details with stale-result protection.'
---

## Import and live example

{{aeliqo:example}}

## Purpose

SearchResults ties a supplied card collection to the visible query and its revision. When the query
revision differs from the result revision, it hides the outdated collection and shows refresh guidance;
the application owns searching, counts, and selected detail.

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

This page documents the Aeliqo 0.5 component contract. Keep every installed
Aeliqo package on the same exact version and check the release status
before installing from the registry.
