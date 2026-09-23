---
component: 'foundation.text'
title: 'Text'
family: 'foundation'
contract: 'Render trusted/plain text with locale and wrapping; no untrusted HTML interpolation.'
---

## Import and live example

{{aeliqo:example}}

## Purpose

Render trusted/plain text with locale and wrapping; no untrusted HTML interpolation.

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

This page documents the unreleased 0.5.0 candidate source. The stable npm
release remains 0.4.2; candidate API and behavior details here are not a
guarantee of availability in the stable release.
