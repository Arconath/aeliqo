---
component: 'foundation.link'
title: 'Link'
family: 'foundation'
contract: 'Navigate to an application-approved destination; preserve browser open-in-new-tab behavior.'
---

## Import and live example

{{aeliqo:example}}

## Purpose

Render an application-supplied destination with native link behavior, including keyboard activation and browser navigation. The host must approve `href` and `target`; a cancellable link event lets it intercept activation when needed.

## When to use it

{{aeliqo:fixture}}

## When to use a different component

Use Button when activation changes application state or submits a request. Link should preserve normal browser navigation.

## Properties and defaults

{{aeliqo:properties}}

## Events

{{aeliqo:events}}

## States and failure handling

Relevant states:

{{aeliqo:states}}

{{aeliqo:outcome}}

If `href` is empty or fails the component's URL check, it renders text rather
than a navigable anchor. `disabled` also renders noninteractive text. For an
approved `_blank` destination, the anchor includes `noopener noreferrer`;
the host still decides which destinations users may open.

## Keyboard, focus, and accessibility

Keyboard behavior:

{{aeliqo:keyboard}}

Exposed semantics:

{{aeliqo:semantics}}

## Responsive behavior

The label follows inline text flow and can wrap. Avoid fixed-width wrappers that clip the text or focus outline.

## Style hooks

{{aeliqo:style-hooks}}

{{aeliqo:performance}}

## Related components

- [Button](/components/foundation.button/)
- [Breadcrumb](/components/navigation.breadcrumb/)

## Generated TypeScript declaration

{{aeliqo:declaration}}

## Version

This page documents the Aeliqo 0.5 component contract. Keep every installed
Aeliqo package on the same exact version and check the release status
before installing from the registry.
