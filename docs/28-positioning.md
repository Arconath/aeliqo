# 28 — Differentiation and ecosystem choices

Aeliqo does not need to invent every underlying technology to be valuable. Semantic data modeling, relational plans, schema interchange, declarative plotting and web components already have substantial prior art. The architecture deliberately reuses those ideas while owning the task/meaning/experience conformance boundary.

Tambo describes an agent toolkit around registered React components; Vega-Lite provides declarative visualization; Substrait defines compute-plan interoperability. They inform the design but do not prove Aeliqo's business thesis. [S18, S07, S26]

Aeliqo's intended distinction is an **owned complete UI system**, not just attaching an agent to arbitrary customer components: safe discovery and derived meaning, application-backed query planning, task-preserving responsive/adaptive presentation, one shared web implementation, direct human use, and verifiable data-to-interaction correctness.

Evaluate adoption with equivalent tasks, not feature-name tables. Compare time to integrate a real source, semantic mistakes detected, amount of glue code removed, maintainability after schema change, usability at narrow/zoom sizes, and agent success on unseen requests. Publish methodology and limitations. Do not claim a universal optimum, zero adapters, arbitrary-data understanding, or enterprise scale before proof.

The commercial strategy should protect this trust: complete OSS runtime and components, paid organizational operation. A rewrite succeeds only if normal developers/designers can understand the core model and users can finish tasks more reliably, not because the repository has more IRs or impressive diagrams.

## Master consolidation ecosystem validation

A2UI defines catalog-based declarative UI across trust boundaries; json-render exposes catalog-constrained UI specifications and several renderers; Tambo supports both generated and persistent interactable components. These primary sources make it inappropriate to claim that JSON UI, component selection, cross-framework abstractions, or agent-updated UI are individually new. [R01, R02, R03]

The differentiator to prove is task/meaning continuity from raw application capability through correct multigrain computation to an owned adaptive experience, with high-quality direct components and verifiable user agency. Prefer interoperable edges where a real consumer needs them, but do not add A2UI/AG-UI/Vega/Tambo adapters merely to inflate compatibility. The Aeliqo contract remains the core source of truth; imported/exported subsets disclose lost semantics.
