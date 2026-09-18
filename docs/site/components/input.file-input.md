---
component: 'input.file-input'
title: 'FileInput'
family: 'input'
contract: 'Native file selection; host owns upload and validation; no file bytes enter agent by default.'
---

## Import and live example

{{aeliqo:example}}

## Purpose

Native file selection; host owns upload and validation; no file bytes enter agent by default.

## When to use it

{{aeliqo:fixture}}

## When to use a different component

Use Form to coordinate file metadata with other fields. FileInput does not upload, scan, or persist the selected file.

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

Keep file type and size limits in visible helper text. Let long file names wrap instead of moving actions offscreen.

## Style hooks

{{aeliqo:style-hooks}}

{{aeliqo:performance}}

## Related components

- [Form](/components/input.form/)
- [FieldGroup](/components/input.field-group/)

## Generated TypeScript declaration

{{aeliqo:declaration}}

## Version

Aeliqo 0.4.2.
