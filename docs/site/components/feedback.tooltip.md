---
component: 'feedback.tooltip'
title: 'Tooltip'
family: 'feedback'
contract: 'Supplemental nonessential information; works on focus, dismisses, not the sole label.'
---

## Import and live example

{{aeliqo:example}}

## Purpose

Reveal a short supplemental explanation when its built-in trigger receives focus or hover. Escape hides it, and it never replaces the trigger's accessible name or essential instructions outside the tooltip.

## When to use it

{{aeliqo:fixture}}

## When to use a different component

Use Popover when content needs interaction or richer structure. Tooltip text should be short and supplemental.

## Properties and defaults

{{aeliqo:properties}}

## Events

{{aeliqo:events}}

## States and failure handling

Relevant states:

{{aeliqo:states}}

{{aeliqo:outcome}}

The built-in trigger opens the tooltip on focus or pointer hover and closes
it on blur, pointer leave, or Escape. There is no `disabled` property and no
separate component event. Remove the trigger when the explanation must be
unavailable; setting `open` to false alone will not disable focus or hover.
Keep a concise visible trigger label,
because tooltip content is supplementary.

## Keyboard, focus, and accessibility

Keyboard behavior:

{{aeliqo:keyboard}}

Exposed semantics:

{{aeliqo:semantics}}

## Responsive behavior

Keep essential instructions outside the tooltip. The trigger remains the layout anchor when the viewport is narrow or zoomed.

## Style hooks

{{aeliqo:style-hooks}}

{{aeliqo:performance}}

## Related components

- [Popover](/components/feedback.popover/)
- [Dialog](/components/feedback.dialog/)

## Generated TypeScript declaration

{{aeliqo:declaration}}

## Version

This page documents the unreleased 0.5.0 candidate source. The stable npm
release remains 0.4.2; candidate API and behavior details here are not a
guarantee of availability in the stable release.
