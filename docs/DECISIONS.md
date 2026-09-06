# Architectural Decisions

## D001 — Product

Accepted.

The product is a Aeliqo Framework.

It is not an application framework.

## D002 — Framework Support

Accepted.

Core is framework-agnostic.

React is first-class and the only required renderer for the POC.

## D003 — Components

Accepted.

The framework ships its own ready-to-use Smart semantic components.

The primary component model is not wrapping arbitrary customer components.

## D004 — Component Levels

Accepted.

There are three conceptual levels:

1. Smart primitives;
2. Smart compound components;
3. Smart Workspace.

## D005 — Smartness

Accepted.

Smartness is internally categorized as:

- data;
- component;
- interaction;
- workspace.

## D006 — Dataset Ownership

Accepted.

Application data/state remains application-owned.

Framework state is presentation/composition state.

## D007 — Dataset Semantics

Accepted.

Runtime semantics are explicit.

TypeScript type names are insufficient as the runtime semantic model.

## D008 — Agent Paths

Accepted.

MCP is primary.

BYOK is secondary.

WebMCP support is experimental.

All use the same Capability Contracts.

## D009 — Arbitrary UI Generation

Rejected.

Agents cannot generate executable JSX, JavaScript, CSS, or arbitrary HTML.

## D010 — Visualization

Accepted.

POC and initial product direction are 2D-only.

D3 is the primary low-level visualization toolkit.

Three.js is outside scope.

## D011 — AI Landscape Proof Dataset

Accepted.

The POC uses a curated deterministic snapshot of organizations, people, AI models, and pricing.

Live web ingestion is outside POC scope.

## D012 — Protocol Parity

Accepted.

MCP, BYOK, and WebMCP experimental may use different reasoning/tool-call sequences.

They must share:

- capabilities;
- dispatcher;
- WorkspaceOperations;
- semantic outcome rules.

## D013 — Performance

Accepted.

Agent reasoning remains outside the render hot path.

Workspace mutation is incremental.

## D014 — Proof Standard

Accepted.

Build/test success alone is insufficient.

The framework thesis must be evaluated through visible and measured proof scenarios.

## D015 — Incremental v1 migration

Retain the v1 workspace, React components and acknowledged MCP bridge. Semantic schemas and typed execute handlers now live in core CapabilityContracts; every adapter routes through the same dispatcher. Zod and its JSON Schema projection are framework-independent validation dependencies, not protocol dependencies.

## D016 — Local companion and experimental host

One local companion owns MCP stdio, an acknowledged single-browser WebSocket and BYOK HTTP requests. Provider keys remain in the Node process. WebMCP uses the current `document.modelContext.registerTool(tool, { signal })` API with abort-based cleanup, isolated in its optional package. Older preview tabs must release the single active bridge connection.

## D017 — Evidence boundaries

The snapshot and component catalog are frozen before challenge execution. A scripted provider is deterministic test evidence only; it does not prove model reasoning. Native WebMCP was available in the Codex in-app browser, while standard test Chromium lacked it. No historical price series or unsupported person-to-model authorship is inferred. Derived organization metrics and a sourced flagship classification were not added to repair failed challenges.

## D018 — Expanded flexibility after the original proof

The user explicitly expanded scope after the frozen v2 evaluation. Add declared field projection, grouped time series, bounded table virtualization, semantic grid spans and move operations. These are generic capabilities; no intent-specific pages are introduced. Synthetic workload history is separate from sourced prices and explicitly labelled. Organization summaries are application-owned derived data. The original partial-proof verdict and frozen evidence remain historical; these additions do not retroactively change that evaluation.

## D019 — Fixed rich semantic catalog

Accepted.

The POC catalog now contains Metric, Ranking, Trend, Table, Detail, Scatter, Distribution, Relationship and Matrix, plus Comparison and Explorer. Scatter, Distribution, Relationship and Matrix are trusted React components configured by semantic fields. D3 provides modular calculations while React owns SVG and DOM lifecycle. The catalog was frozen before the second unseen-intent evaluation.

## D020 — Connected graph and semantic composition

Accepted.

The application-owned snapshot projects Provider, Model, Pricing, Capability, Modality, ModelLimit, Benchmark, BenchmarkResult, Release and Availability into connected semantic datasets. A Showcase composer matches declared semantic needs to the fixed catalog and emits ordinary incremental WorkspaceOperations. Scenario descriptions contain no React component names or executable UI.

Comparable coding results are synthetic POC fixtures with one declared methodology and a visible caveat. They demonstrate semantic comparison behavior, not real product quality. Current prices remain single-snapshot data; unsupported historical trends and universal quality claims fail safely.

## D021 — Production-quality local continuation

Extend the existing implementation with explicit weighted-ratio/units/grain/scope/time semantics, trusted component registration, shared core receipts, explicit pairing and human workspace controls. Receipt version 0.2 replaces the adapter-local prototype. Operation grammar remains version 1 with additive pin/history/filter/config fields. Stricter currency and temporal validation are documented in the local reference; legacy ISO month/day fields remain supported. No arbitrary wire code or implicit cross-dataset joins are introduced.

Metric/Table/Filter initially gained direct props and real import subpaths. A subsequent foundation tranche added equivalent Ranking/Trend/Detail entry points, fixed negative ranking geometry, added individual filter removal, and composed Filter into Explorer. Local private ESM/types/CSS artifacts and installed consumer checks cover all six entry points. The original frozen catalog proof remains historical; Filter and registries are post-proof additions. Public license/publication, external usability and paid demand remain evidence/owner decisions rather than claims derived from local tests.
