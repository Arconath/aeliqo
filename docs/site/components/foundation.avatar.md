---
component: 'foundation.avatar'
title: 'Avatar'
family: 'foundation'
contract: 'Display optional identity image; fallback initials and privacy-safe alt policy.'
---

## Import and live example

{{aeliqo:example}}

## Purpose

Show one person's identity with an optional image and a name-based initials fallback when the image is absent or fails. Set `alt` for a meaningful image; use `decorative` only when nearby text already names the person.

## When to use it

{{aeliqo:fixture}}

## When to use a different component

Use Text when the person’s name must remain visible. Avatar is a compact identity cue, not a replacement for record details.

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

Avatar uses its selected size. Pair it with wrapping identity text when initials alone do not fit the narrow layout.

## Style hooks

{{aeliqo:style-hooks}}

{{aeliqo:performance}}

## Related components

- [Text](/components/foundation.text/)
- [RecordList](/components/data.record-list/)

## Generated TypeScript declaration

{{aeliqo:declaration}}

## Version

This page documents the unreleased 0.5.0 candidate source. The stable npm
release remains 0.4.2; candidate API and behavior details here are not a
guarantee of availability in the stable release.
