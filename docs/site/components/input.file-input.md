---
component: 'input.file-input'
title: 'FileInput'
family: 'input'
contract: 'Native file selection; host owns upload and validation; no file bytes enter agent by default.'
---

## Import and live example

{{aeliqo:fixture}}

{{aeliqo:example}}

## Purpose

Opens the native file picker and reports selected file metadata. It checks configured count and size limits; the host owns bytes, upload, and server validation.

## When to use it

- People choose local files to attach or upload.
- The form must declare file count or size limits.
- The host needs file names and sizes before deciding to upload.

## When to use a different component

- Use [Form](/components/input.form/) when the file selection submits with other fields.
- Use [FieldGroup](/components/input.field-group/) when the picker belongs inside a labelled group.

## Properties and defaults

{{aeliqo:properties}}

## Events

{{aeliqo:events}}

## States and failure handling

Relevant states:

{{aeliqo:states}}

{{aeliqo:outcome}}

`maxFiles` and `maxBytes` mark a selected set invalid when its file count or
combined byte size exceeds the configured bound; the metadata event still
reports that selection. They are not upload quotas or server-side validation.
An application must check file content and size again before storing anything.
`accept` and `capture` are browser picker hints, not proof of type or origin.

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

This page documents the Aeliqo 0.5 component contract. Keep every installed
Aeliqo package on the same exact version and check the release status
before installing from the registry.
