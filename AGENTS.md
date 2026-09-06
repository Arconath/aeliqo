# Aeliqo Framework — Agent Guide

## Mission

This repository is a proof of concept for the Aeliqo Framework.

The framework provides its own ready-to-use semantic UI components and allows them to adapt intelligently at the:

1. data level;
2. component level;
3. interaction level;
4. workspace level.

The POC must prove the architecture with the smallest complete implementation.

Do not expand breadth until the core thesis is proven.

## Product Model

This project is a UI framework, not an application framework.

It is intended to be installable inside applications built with frameworks such as React, Next.js, and eventually other UI frameworks.

Architecture:

- framework-agnostic headless core;
- first-class React renderer;
- framework-owned semantic components;
- external application data remains application-owned;
- MCP as the primary AI control path;
- BYOK model APIs as a secondary control path;
- WebMCP support as experimental.

## Required Reading

Before implementation work, read:

- `docs/POC.md`
- `docs/ARCHITECTURE.md`
- `docs/QUALITY.md`
- `docs/DECISIONS.md`

After proof execution, use:

- `docs/PROOF.md`

Do not duplicate long documentation into this file.

## Core Thesis

Developers should describe data semantics once.

The framework should then be able to reuse those semantics across multiple Aeliqo components and allow an agent to compose useful interfaces for intents that were not implemented as dedicated pages.

The agent must not generate arbitrary:

- JSX;
- JavaScript;
- CSS;
- HTML;
- executable application code.

Agents may only use trusted semantic capabilities exposed by the framework.

## Three UI Levels

### Level 1 — Smart semantic primitives

Initial POC:

- Metric
- Ranking
- Trend
- Table
- Detail
- Relationship if required for the AI-landscape proof

These are higher-level semantic components.

They are not Button/Card/Input primitives.

### Level 2 — Smart compound components

Initial POC:

- Comparison
- Explorer

Compound components must reuse Level-1 primitives.

Do not reimplement primitive behavior inside compound components.

### Level 3 — Smart Workspace

The Workspace manages:

- composition;
- semantic data bindings;
- relationships;
- mounting/unmounting;
- configuration;
- semantic selection/focus.

The Workspace must not own application business data.

## Smart Categories

All Aeliqo behavior must map to one of these categories:

### Data smartness

Understand semantic datasets, fields, units, metrics, dimensions, time, aggregation, and relations.

### Component smartness

Adapt presentation, density, labels, rendering strategy, or useful state without changing the meaning of the user's question.

Component smartness should be deterministic and must not require an LLM for ordinary rendering.

### Interaction smartness

Compatible semantic outputs and inputs can connect without page-specific glue code.

Example:

`Ranking<AIModel> -> selected AIModel -> Detail<AIModel>`

### Workspace smartness

Trusted semantic operations can incrementally alter composition and relationships.

## AI Control Paths

All control paths MUST project the same Capability Contracts.

### MCP

Primary supported AI path.

Must work with a real external agent such as Codex.

### BYOK

Required secondary proof path.

Use one real provider implementation plus a deterministic test provider.

Provider secrets must not be exposed in browser bundles or localStorage.

### WebMCP

Required experimental proof path.

Public positioning:

`WebMCP support: experimental`

It must remain optional.

Its absence must not break:

- core;
- React;
- MCP;
- BYOK.

Use the current supported WebMCP API surface in the implementation.

## Shared Capability Layer

The POC should expose a minimal capability surface:

- `workspace_inspect`
- `catalog_search`
- `data_query`
- `workspace_apply`

Do not expose low-level DOM manipulation tools.

Do not implement separate business or workspace logic for:

- MCP;
- BYOK;
- WebMCP.

All adapters must converge on the same Capability Dispatcher and Workspace Operations.

## AI Landscape Proof Dataset

The POC uses a curated deterministic AI-landscape snapshot.

Primary entities:

- Organization
- Person
- AI Model
- Model Pricing

Minimum relations:

- Person -> Organization
- Model -> Organization
- Pricing -> Model

Minimum semantic fields should include enough information to support:

- ranking;
- comparison;
- trends where data permits;
- filtering;
- entity inspection;
- relationship visualization.

The snapshot must include source metadata and a verified snapshot date.

Do not turn the POC into a live web-scraping or research pipeline.

The framework is being tested, not the data-ingestion system.

## Dependency Direction

Allowed:

`react -> core`

`mcp -> core`

`byok -> core`

`webmcp-experimental -> core`

`playground -> core + react + protocol adapters`

Not allowed:

`core -> react`

`core -> D3`

`core -> MCP`

`core -> model provider SDK`

`core -> WebMCP browser APIs`

`core -> Node-only APIs`

Do not introduce circular package dependencies.

## Coding Rules

- TypeScript strict mode.
- Keep public APIs intentionally small.
- Prefer explicit contracts.
- Prefer pure functions in core.
- Keep effects in adapters.
- Avoid `any`.
- Avoid speculative abstractions.
- Keep one source of truth for semantic contracts.
- Validate every untrusted agent/protocol input at runtime.
- Keep raw large datasets outside Workspace state.
- Do not perform network/model calls during render.
- Do not duplicate capability handlers across protocols.

## Rendering and Performance

Smartness must remain outside the render hot path.

Principles:

- normalized Workspace state;
- structural sharing;
- fine-grained subscriptions;
- local transient component state;
- lazy loading where useful;
- CSS Grid/Flex/container queries for layout;
- modular D3 imports;
- React owns rendered DOM/SVG;
- no expensive aggregation repeatedly during render;
- agent latency measured separately from UI rendering;
- incremental Workspace operations rather than complete UI regeneration.

Measure before introducing:

- Canvas;
- Web Workers;
- custom schedulers;
- advanced caching.

## Work Loop

For each implementation task:

1. inspect the current repository;
2. read relevant docs;
3. identify the smallest change that satisfies the proof;
4. implement it;
5. run focused checks;
6. run full relevant validation;
7. update docs only if architecture or source-of-truth behavior changed.

Do not stop after planning when implementation is requested.

For multi-step requests, track every authorized deliverable in `docs/aeliqo/exec-plan.md` and continue through the next ready item after each milestone. Do not end at a partial passing slice or treat occupied development ports as a final blocker; isolate verification. Before reporting completion, reconcile the full plan with fresh integrated evidence and explicitly distinguish remaining external evidence from completed local work. Never silently narrow the user's requested scope.

## Proof Discipline

A passing build does not prove the thesis.

The POC must produce visible evidence for:

- semantic reuse;
- component smartness;
- interaction smartness;
- workspace smartness;
- MCP path;
- BYOK path;
- WebMCP experimental path;
- protocol parity;
- unseen-intent composition;
- targeted rendering performance.

Failures must be recorded honestly.

Do not create intent-specific pages or templates to make an evaluation pass.

## Scope Exclusions

Do not add:

- production cloud infrastructure;
- authentication platform;
- database persistence;
- billing;
- collaboration;
- Vue renderer;
- Svelte renderer;
- multiple real BYOK providers;
- 3D;
- Three.js;
- arbitrary generative UI;
- browser automation fallback;
- dozens of components;
- plugin marketplace.

If a simpler implementation proves the same abstraction, choose the simpler one.
