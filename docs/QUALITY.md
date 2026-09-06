# Quality and Performance

## Philosophy

The POC must prove that Aeliqo does not imply slow UI.

Agent intelligence remains outside the render hot path.

## Correctness

Semantic correctness is more important than visual cleverness.

Do not:

- average ratios incorrectly;
- silently alter metric meaning;
- infer unsupported relationships;
- hide unavailable data behind fabricated fallback content.

## Type Safety

- TypeScript strict mode.
- Runtime validation at protocol boundaries.
- No reliance on erased TypeScript types for domain semantics.
- Avoid `any`.

## Render Boundaries

Workspace changes must be incremental.

Use:

- normalized state;
- stable identities;
- structural sharing;
- fine-grained subscriptions.

Transient state such as:

- hover;
- tooltip;
- local input;
- expanded row;
- temporary animation state;

should remain component-local.

## Data

Do not copy entire datasets into Workspace state.

Workspace references datasets semantically.

Expensive data transforms must not run repeatedly during React render.

## React

Use an appropriate external-store subscription model.

Avoid Workspace-wide state values that invalidate all descendants for local changes.

Instrument representative components during development to expose update counts.

## D3

Use modular D3 packages.

Do not import all of D3 by default.

React owns rendered DOM/SVG.

D3 owns visualization calculations.

Use SVG first.

Canvas is optional and requires measured justification.

## Lists and Tables

Use virtualization when the demonstrated dataset size requires it.

Do not introduce virtualization only because it sounds performant.

## Layout

Prefer CSS over JavaScript for visual responsiveness.

Use container queries where component behavior depends on local available space.

## Agent Latency

Measure separately:

- model/agent latency;
- protocol/transport latency;
- data-query latency;
- Workspace operation latency;
- React update latency.

Never present model latency as framework render latency.

## Proof Instrumentation

Development Proof Lab should expose:

- Workspace revision;
- latest operations;
- operation source;
- mounted component graph;
- component update counts;
- local operation timing;
- React update timing where measurable.

## Accessibility

Components should support:

- keyboard interaction;
- visible focus;
- semantic labels;
- useful empty/loading/error states;
- reduced motion.

## Required Validation

Maintain:

- typecheck;
- lint;
- unit tests;
- integration/component tests;
- browser-level tests;
- production build.

Protocol adapters require contract-parity tests.

## Performance Rule

Do not optimize hypothetical bottlenecks.

Measure first.

Do not add:

- Canvas;
- Worker;
- scheduler;
- cache layer;

without a demonstrated bottleneck.
