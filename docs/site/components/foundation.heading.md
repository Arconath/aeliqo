---
component: 'foundation.heading'
title: 'Heading'
family: 'foundation'
contract: 'Preserve logical document hierarchy independent of visual size.'
---

## Import and live example

{{aeliqo:example}}

## Purpose

Render heading text at the requested document level while choosing its visual size separately. Changing its appearance does not change the heading level announced to assistive technology.

## When to use it

{{aeliqo:fixture}}

## When to use a different component

Use Text for body copy. Keep heading levels tied to the document outline even when visual size changes.

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

Headings wrap with the reading column. Preserve their document order if the host changes the visual size or section layout.

## Style hooks

{{aeliqo:style-hooks}}

{{aeliqo:performance}}

## Related components

- [Text](/components/foundation.text/)
- [Separator](/components/foundation.separator/)

## Generated TypeScript declaration

{{aeliqo:declaration}}

## Version

This page documents the unreleased 0.5.0 candidate source. The stable npm
release remains 0.4.2; candidate API and behavior details here are not a
guarantee of availability in the stable release.
