# 00 — Decision record and product constitution

Status: v0.1.0 implementation contract, 7 September 2026. Supersedes earlier brainstorming when statements conflict. Facts about third-party tools are sourced in [research](24-research-sources.md); the architecture below is a proposed engineering design, not proof of product performance or novelty.

## Product

Aeliqo turns an authorized user's request and application-owned data into an interactive interface assembled from Aeliqo's own trusted primitives, 2D visualizations, and approved patterns. It serves embedded application regions as well as full workspaces. It does not require a chat-first screen. Standalone components remain useful without a semantic catalog, query runtime, agent, or cloud account.

The product is an **opinionated adaptive application UI framework**, not a full-stack framework. It orchestrates data *for experience* without taking ownership of the database, application auth, domain services, routing, deployments, or background jobs.

## Binding decisions

| Area | Decision | Consequence |
|---|---|---|
| Data integration | One Application Data Contract, with an in-process implementation and generic HTTP transport | Vendor-specific schema importers are optional authoring tools, not runtime connectors |
| Semantics | Typed identity, grain, dimension, metric, time, relation and action descriptors | No HR, customer, commerce or provider domain logic in core |
| Derived meaning | Proven structural operations, plus AI-assisted or manual definitions using one typed expression system | Unknown business meaning never becomes hidden truth |
| Intelligence | LLM may propose/refine intent, semantic definitions and high-level view preferences; deterministic code binds, validates, plans and executes | Do not artificially ban useful model reasoning, but do not let it become a trusted evaluator |
| User experience | An Aeliqo experience standard with approved patterns and bounded customization | No arbitrary layout language or CSS generation exposed to agents |
| UI selection | Task + result semantics + information/operation requirements + environment + policies + preferences | Shape alone never establishes the best view |
| UI implementation | One shared web implementation using native web components/Lit; thin React binding; framework-free use mandatory | No separate React/Vue/Svelte copies of the catalog |
| Platform abstraction | Semantic presentation contracts and renderer capabilities are platform-neutral | Native desktop/mobile are extensibility targets, not falsely claimed v0.1.0 renderers |
| 2D | Declarative plot specifications, modular D3 calculations, SVG default, bounded Canvas path when measured | No Three.js, 3D, GPU-first rewrite or canvas-rendered forms |
| OSS | Apache-2.0 for core, runtime, web, React, agents, testkit and local authoring/devtools | No paid row caps, locked primitive families, or safety/accessibility paywall |
| Commercial | Hosted collaboration and governance operations; enterprise support and private managed deployments | The paid service is separate from the portable runtime |
| Rewrite | Clean source tree on a new branch, historical parent retained | Existing main/site/registry stay intact until evidence-gated promotion |
| Version | New unused 0.1.0, RCs under next first | Never overwrite/unpublish an earlier published version as a migration shortcut |
| Delivery | Complete release catalog and end-to-end tasks must pass gates | No relabeling a scaffold, demo or mock as production-ready |

## Corrections to earlier brainstorming

A renderer-agnostic contract cannot eliminate the need for an actual platform implementation. A single web platform implementation can eliminate per-framework duplication; it cannot guarantee identical native-widget behavior on every possible platform.

OpenAPI describes operations and data shape, not arbitrary join support or business meaning. GraphQL introspection may be disabled and does not imply analytics operators. TypeScript types disappear at runtime; a runtime schema, generated manifest or explicitly authorized sample is required. Standard Schema validation interoperability is distinct from obtaining inspectable JSON Schema.

A numeric field is not automatically additive. Counting rows is only counting employees when row grain and identity establish that meaning. A single snapshot is not history. A three-month calendar period is not automatically ninety days.

A phone-sized viewport does not mean no keyboard. A custom element wrapper does not automatically solve SSR, focus, forms, or screen-reader interoperability. A schema-valid model response is not a correct business rule. A renderer callback is not proof that a human saw pixels.

Information reachability alone is insufficient: a user comparing eight columns across two records may require an approved scrollable comparison rather than a list with details hidden behind separate taps. An explicit table choice is not silently replaced just because a width heuristic prefers cards.

## Scope guardrails

v0.1.0 must implement the finite complete catalog in `harness/components.json`. Completeness means every advertised entry meets its states, interactions, documentation and evidence contract, not that every conceivable widget exists. Future families (3D, CAD, rich media editing, full GIS engine, spreadsheet engine, enterprise scheduler, arbitrary workflow programming) require separate decisions.

Do not build a general federated database engine. Logical query planning is deliberately restricted to a testable relational/semantic subset. An application executor can implement broader domain capabilities behind the same contract. Cross-source joins are denied unless explicitly supported with bounded execution and consistency semantics.

Do not make a giant policy language, plugin marketplace, distributed runtime, CRDT or new renderer framework in order to ship v0.1.0. Registry extension must have concrete consumer evidence and conformance tests.

## Authority is an intersection

Truth/correctness, authorization, accessibility, explicit user restrictions, application capability and designer constraints must all hold. They are not a sorted list in which a higher item can override a lower one. If the intersection is empty, explain the conflict and offer valid alternatives; do not silently choose a violation.

Only after feasible candidates exist may task fit, aesthetics, density, platform cost and user preference rank them. Security cannot be outvoted by a score. Designer preference cannot remove required accessibility. A requested visual cannot create missing data.

## Definition of revolutionary

The differentiator to test is **task-preserving compilation from governed meaning to adaptive application experience**, with measurable conformance across data and pixels. Semantic layers, query plans, custom elements and visualization grammars already exist. We claim an integration/design thesis, not an unprecedented invention or proven product-market fit.

## Master consolidation closure: binding clarifications, not another architecture

This consolidated Master consolidation tree incorporates the separate September 7 revalidation. Earlier chats are historical; these documents govern implementation. Pattern-assisted bounded composition is mandatory; matching a named preset is not. Roles are requirement metadata, not a closed domain taxonomy. A model may propose an approved composition or bounded query expression; all proposals use the same validators as deterministic candidates.

A Task can have named outputs with different grains and dependencies, or be a presentation-only/form task with no synthetic read. Evaluate/inspect is a read operation; present/commit is a separate UI operation. Most user interactions bypass both the model and global replanning. Derived outputs may be temporary without publishing a reusable business metric.

Deterministic does not mean truthful, optimal, accessible, or useful by itself. Runtime enforcement establishes specific contracts; empirical query, task, visual, assistive-technology, narrative and provider evaluations establish their corresponding evidence. TypeScript passing does not constitute a runtime validator. The reference files in contracts/ are executable design probes, not the completed SDK.

An accepted plan is a candidate subject to rechecking its read set and authorization at commit. Trust/approval/source identity is supplied by the host context, never accepted from agent payload fields claiming `human` or `approved`. Correctness includes stale-result rejection, not just initial validation.

No absolute guarantee of zero defects or universal optimal UI is a release claim. The objective is measurable task-preserving intelligence with a documented support boundary. Do not continue redesigning vocabulary after these corrections: implement counterexamples, profile, and change a boundary only with a failing requirement and an ADR.

## Master edition 1 — canonical references

Target0.1.0 and MASTER-SOT.md govern this edition. Model capability is not authority; valid proposals may still misinterpret intent. Independent effect grants, binder states and residual semantic risk are canonical in chapter37. Patterns remain optional, 71components remain required, and exact-version reset rules are in chapter18.

[Master](../MASTER-SOT.md) · [AI contract](37-model-failure-containment.md) · [Release](18-release-migration.md).

## Edition 1.1 clarification: developer-authored meaning

Manual meaning includes first-class typed developer code/config as well as a Studio editor. AI assistance is available to either author. All authoring surfaces use one canonical definition/evaluator; deployed defaults do not require end users to recreate or reapprove them. Code ownership, revision conflict, optional overrides and activation follow the detailed [meaning contract](03-semantics-derived.md). This is a DX clarification, not a new abstraction, package or product version.
