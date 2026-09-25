---
component: 'foundation.text'
title: 'Text'
family: 'foundation'
contract: 'Render trusted/plain text with locale and wrapping; no untrusted HTML interpolation.'
---

## Import and live example

{{aeliqo:example}}

## Purpose

Render a trusted string as text in the chosen semantic element, with optional muted emphasis. Text is inserted as content rather than interpreted as HTML, so the host controls its meaning and formatting.

## When to use it

{{aeliqo:fixture}}

## When to use a different component

Use Heading for a section title and Badge for a short status or category. Text is ordinary trusted copy.

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

Text follows its parent width. Allow long values to wrap and avoid fixed-height containers when zoom or localization adds lines.

## Style hooks

{{aeliqo:style-hooks}}

{{aeliqo:performance}}

## Related components

- [Heading](/components/foundation.heading/)
- [Badge](/components/foundation.badge/)

## Generated TypeScript declaration

{{aeliqo:declaration}}

## Version

This page documents the Aeliqo 0.5 component contract. Keep every installed
Aeliqo package on the same exact version and check the release status
before installing from the registry.
