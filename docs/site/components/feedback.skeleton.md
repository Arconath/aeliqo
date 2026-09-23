---
component: 'feedback.skeleton'
title: 'Skeleton'
family: 'feedback'
contract: 'Stable reserved geometry with reduced motion and a named loading state.'
---

## Import and live example

{{aeliqo:example}}

## Purpose

Reserve a visible shape for content that is still loading. Line count and variant describe the expected geometry; the host must replace it with an actual result, empty state, or error rather than leaving it as data evidence.

## When to use it

{{aeliqo:fixture}}

## When to use a different component

Use Progress when progress can be measured. Replace Skeleton with ready content, an empty state, or an error when the result is known.

## Properties and defaults

{{aeliqo:properties}}

## Events

{{aeliqo:events}}

## States and failure handling

Relevant states:

{{aeliqo:states}}

{{aeliqo:outcome}}

The text variant renders between one and twelve lines, clamping an out-of-range
`lines` value; rectangular and circular variants render one shape. Reduced
motion turns off the pulse animation. The skeleton carries a loading status,
but it cannot tell whether a request later became empty, denied, or failed.

## Keyboard, focus, and accessibility

Keyboard behavior:

{{aeliqo:keyboard}}

Exposed semantics:

{{aeliqo:semantics}}

## Responsive behavior

Match the width of the content it replaces without forcing horizontal scroll. Reduced-motion settings stop its animation.

## Style hooks

{{aeliqo:style-hooks}}

{{aeliqo:performance}}

## Related components

- [Progress](/components/feedback.progress/)
- [EmptyState](/components/feedback.empty-state/)

## Generated TypeScript declaration

{{aeliqo:declaration}}

## Version

This page documents the unreleased 0.5.0 candidate source. The stable npm
release remains 0.4.2; candidate API and behavior details here are not a
guarantee of availability in the stable release.
