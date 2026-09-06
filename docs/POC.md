# Aeliqo Framework POC v2

## Purpose

This POC exists to determine whether the proposed Aeliqo Framework has enough technical and product value to justify building a real framework.

It is not intended to demonstrate feature breadth.

It is intended to produce falsifiable evidence.

## Central Question

Can a small fixed library of trusted semantic UI components:

1. understand one shared semantic data model;
2. adapt intelligently without generating arbitrary UI code;
3. connect to each other semantically;
4. be composed into useful workspaces for previously unseen intents;
5. be controlled through MCP, BYOK, and experimental WebMCP;
6. remain fast and visually coherent?

## Product Shape

The intended product is:

Aeliqo Framework
+
ready-to-use Smart components
+
semantic data model
+
adaptive Workspace
+
agent interoperability

It is not:

- a Next.js replacement;
- an AI dashboard application;
- a low-level Button/Card component library;
- a built-in AI chatbot;
- an arbitrary generative UI system.

## Framework Architecture

The POC contains:

- framework-agnostic headless core;
- React-first renderer;
- Smart semantic components;
- D3-powered 2D visualization where appropriate;
- MCP adapter;
- BYOK adapter;
- experimental WebMCP adapter.

## UI Levels

### Level 1 — Smart primitives

Required:

- Metric
- Ranking
- Trend
- Table
- Detail

Optional only if useful to proof:

- Relationship

### Level 2 — Smart compound components

Required:

- Comparison
- Explorer

### Level 3 — Smart Workspace

Required:

- semantic composition;
- mounting/removal;
- configuration;
- relationships;
- semantic selections;
- incremental Workspace operations.

## AI Landscape Dataset

The POC uses a curated snapshot of the current AI landscape.

The rich Showcase projects one connected application-owned graph across Provider, Model, Pricing, Capability, Modality, ModelLimit, Benchmark, BenchmarkResult, Release and Availability. Relationships are declared in dataset contracts and followed by the workspace; components do not join unrelated files during render. Comparable benchmark values are explicitly synthetic, single-methodology POC fixtures and are never presented as a universal quality score.

Entities:

### Organization

Examples:

- OpenAI
- Anthropic
- Google DeepMind / Google
- xAI

Fields may include:

- id;
- name;
- website;
- description;
- snapshot metadata.

### Person

Fields:

- id;
- name;
- role;
- organizationId.

Do not infer unsupported person-to-model relationships.

### AI Model

Fields may include:

- id;
- name;
- organizationId;
- family;
- release date;
- context window;
- supported modality;
- reasoning capability classification where sourced.

### Model Pricing

Fields may include:

- modelId;
- input price per million tokens;
- cached input price where available;
- output price per million tokens;
- pricing tier/context metadata where required.

Every dataset snapshot should carry:

- source;
- source date or retrieval date;
- snapshot version.

This is curated deterministic test data.

No live scraping is required.

## Dataset Semantics

The framework must be able to distinguish:

- entity;
- dimension;
- metric;
- category;
- time;
- relationship;
- formatting/unit;
- aggregation semantics.

Runtime meaning must not rely only on TypeScript types.

## Required Smartness Proofs

### Data

One semantic dataset definition powers multiple components.

Example:

Model Pricing can feed:

- Ranking;
- Comparison;
- Table;
- Detail.

### Component

At least one component adapts presentation deterministically.

Example:

Ranking adapts between:

- compact ranking;
- richer ranking;
- virtualized or summarized large ranking;

without invoking an LLM.

The fixed primitive catalog also includes Scatter, Distribution, Relationship and Matrix. Scatter correlates two declared metrics and can expose a deterministic Pareto frontier. Distribution shows spread and IQR outliers. Relationship follows only a declared dataset edge. Matrix compares declared semantic feature columns. Modular D3 packages perform calculations while React owns accessible SVG and DOM lifecycle.

### Interaction

A semantic selection from one component feeds a compatible component without page-specific application state glue.

Example:

Model Ranking
-> selected Model
-> Model Detail
-> related Organization Detail if present.

### Workspace

Workspace operations can incrementally:

- mount;
- remove;
- configure;
- connect;
- focus/select.

## Capability Contract

Agent-facing capabilities are defined once and projected into different protocols.

Initial capabilities:

- `workspace_inspect`
- `catalog_search`
- `data_query`
- `workspace_apply`

The execute path must converge on the same core dispatcher.

## AI Paths

### MCP

Primary.

Must be tested with a real external agent.

### BYOK

Secondary.

Must use:

- one real provider;
- one deterministic test provider.

No full chat application is required.

### WebMCP

Experimental.

Must:

- use feature detection;
- be isolated in its own adapter/package;
- expose the same Capability Contracts;
- be tested in a real compatible environment when available.

Documentation must say:

`WebMCP support: experimental`

## Protocol Parity

Use the same intent through:

- MCP;
- BYOK;
- WebMCP experimental.

Canonical parity intent:

"Show the AI models with the lowest output-token pricing and let me inspect the selected model and its organization."

The operation sequence may differ.

The semantic outcome should be equivalent.

All paths must use:

- the same capabilities;
- the same dispatcher;
- the same WorkspaceOperation model.

## Unseen Intent Challenges

After the dataset and component catalog are frozen, test intents such as:

1. Which models have low output prices but large context windows?

2. Compare flagship-model input and output pricing across organizations.

3. Show models below a selected output-price threshold and let me inspect their organizations.

4. Show the relationship between major AI labs, their key people, and their models.

5. Which organizations have the widest pricing spread across their models?

6. Compare two selected AI organizations and focus on their largest differences.

Do not add intent-specific pages after observing the challenge.

## Direct No-Agent Proof

The framework must remain useful without AI.

Developers can explicitly use:

- Ranking;
- Comparison;
- Explorer;
- Detail;
- Workspace operations.

AI is an additional control plane.

It is not a rendering dependency.

## Success Criteria

The POC is considered strongly proven only if:

- semantic data is defined once and reused;
- Smart component behavior is visible;
- semantic interaction reduces application glue;
- multiple unseen intents are solved without source changes;
- MCP works end-to-end;
- BYOK works end-to-end;
- WebMCP experimental works in a compatible environment;
- all protocol paths share one capability implementation;
- no arbitrary UI code is generated;
- targeted Workspace changes remain responsive;
- resulting UI remains coherent and usable.
