# Start with one useful component

Page role: onboarding. Public copy draft; implementation instructions below are for the project team.

## Suggested introduction

Build interfaces that understand the data they present. Start with a single component, add shared semantics when you need them, and compose an adaptive workspace when your task spans several views. You do not need an AI model or a hosted account to render and interact with components.

## Page structure

Show a small working Metric and a usable Table before discussing architecture. Include the **actual** install command generated from the package being tested, its CSS import and a minimal runnable source example. Do not publish a fictional package name. Show version/framework requirements from a verified consumer fixture.

Then introduce one field with a unit, one shared selection and one semantic Comparison. Let readers choose the next step: customize the component or connect two views. Workspace and agent setup are subsequent steps, not prerequisites.

## Interactive preview

Only essential controls: container width, locale and data state. Default data has enough variation to reveal useful behavior. Long labels and missing values have named presets. Put Preview and Code first; expose Contract as a secondary disclosure. Reset is predictable, focus does not jump, and synthetic data is visibly identified.

## Implementation proof

The sample runs from the same example source checked in CI. Test keyboard-only completion, narrow viewport and local code overflow. A new user must find the needed CSS import without searching a second page. Static explanatory content remains readable when JavaScript or the interactive demo fails.
