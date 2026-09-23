---
component: 'feedback.progress'
title: 'Progress'
family: 'feedback'
contract: 'Determinate or unknown progress honestly; no invented completion percentages.'
---

## Import and live example

{{aeliqo:example}}

## Purpose

Describe an ongoing operation with native progress semantics. A bounded value reports determinate progress; an absent value stays indeterminate, so the component never invents a completion percentage.

## When to use it

{{aeliqo:fixture}}

## When to use a different component

Use Skeleton while the shape of pending content is known. Use Progress when the host can report operation progress.

## Properties and defaults

{{aeliqo:properties}}

## Events

{{aeliqo:events}}

## States and failure handling

Relevant states:

{{aeliqo:states}}

{{aeliqo:outcome}}

With no finite `value`, the component renders an indeterminate progressbar.
For determinate progress, it clamps the displayed value to the range from zero
to `max`; an invalid or nonpositive `max` falls back to 100. The host should
report completion only when the underlying operation actually finishes.

## Keyboard, focus, and accessibility

Keyboard behavior:

{{aeliqo:keyboard}}

Exposed semantics:

{{aeliqo:semantics}}

## Responsive behavior

The bar follows its host width while the label remains readable. Do not use color alone to report the current value.

## Style hooks

{{aeliqo:style-hooks}}

{{aeliqo:performance}}

## Related components

- [Skeleton](/components/feedback.skeleton/)
- [EmptyState](/components/feedback.empty-state/)

## Generated TypeScript declaration

{{aeliqo:declaration}}

## Version

This page documents the unreleased 0.5.0 candidate source. The stable npm
release remains 0.4.2; candidate API and behavior details here are not a
guarantee of availability in the stable release.
