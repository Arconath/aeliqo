---
component: 'input.field-group'
title: 'FieldGroup'
family: 'input'
contract: 'Group related controls with legend, descriptions and coordinated validation.'
---

## Import and live example

{{aeliqo:example}}

## Purpose

Put related form controls under one legend with shared description and error text. The group can disable its child fieldset, while each child still owns its value and validation behavior.

## When to use it

{{aeliqo:fixture}}

## When to use a different component

Use Form when the controls also need submit and reset behavior. FieldGroup provides shared labeling around child controls.

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

Allow child controls to stack under the legend. Keep the legend and description visible above those controls.

## Style hooks

{{aeliqo:style-hooks}}

{{aeliqo:performance}}

## Related components

- [Form](/components/input.form/)
- [TextField](/components/input.text-field/)

## Generated TypeScript declaration

{{aeliqo:declaration}}

## Version

This page documents the 0.5.0 component contract. Keep every installed
Aeliqo package on the same exact version and check the release status
before installing from the registry.
