---
component: 'input.text-field'
title: 'TextField'
family: 'input'
contract: 'Label, description, validation, autocomplete and IME-safe controlled/uncontrolled value.'
---

## Import and live example

{{aeliqo:fixture}}

{{aeliqo:example}}

## Purpose

A labelled single-line text input with description and validation feedback. Typed drafts and IME composition stay intact while the host controls the value.

## When to use it

- You need one line of free text, such as a name, email, or title.
- The field needs a visible label, hint text, or validation message.
- The value benefits from browser autocomplete or IME composition.
- You want a controlled or uncontrolled initial value.

## When to use a different component

- Use [TextArea](/components/input.text-area/) when the value can span more than one line.
- Use [SearchField](/components/input.search-field/) when the text is a query the host runs.
- Use [NumberField](/components/input.number-field/) when the value must stay an exact number.

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

Keep the label, description, and error visible when the form narrows. Put the field on its own row when the label is long.

## Style hooks

{{aeliqo:style-hooks}}

{{aeliqo:performance}}

## Related components

- [TextArea](/components/input.text-area/)
- [SearchField](/components/input.search-field/)

## Generated TypeScript declaration

{{aeliqo:declaration}}

## Version

This page documents the Aeliqo 0.5 component contract. Keep every installed
Aeliqo package on the same exact version and check the release status
before installing from the registry.
