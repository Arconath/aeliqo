# 21 — Competitive validation and differentiation

Research date: 6 September 2026. Facts below come from primary product documentation; they are not a feature-by-feature hands-on benchmark. Do not infer absence of a feature merely because it is not described on one page.

| System | Verified overlap | What Aeliqo must demonstrate |
|---|---|---|
| json-render | Catalog/registry-driven typed UI specs and rendering [R19] | Data meaning, adaptation and interaction coordination beyond JSON UI |
| Tambo | Generative components/interfaces and interactive UI concepts [R20] | Standalone component value and consistent semantics, not just props updated by AI |
| AG Grid AI Toolkit | Natural-language/grid-state integration capabilities [R21] | Quality outside one grid plus comparable grid workflow correctness |
| MUI X AI Assistant | Prompts connected to data-grid operations [R22] | Cross-component/workspace benefit without worse basic UX |
| A2UI | Catalogs and declarative UI interchange concepts [R23] | Interop adapter boundary; no need to claim a new universal protocol |
| CopilotKit / AG-UI | Agent-to-frontend interaction/state protocol positioning [R24] | Rich data/component contracts, not just an agent bridge |
| WebMCP Auto-UI | Agent/canvas/registry architecture and multiple integrations [R25] | Differentiate on usable components, semantics, evidence and integration burden |
| D3 / Vega-Lite | Low-level or compositional data visualization capability [R09, R29] | Workflow, design system, typed semantics and DX rather than more chart types alone |
| Ark UI / TanStack Virtual | Accessible behavior/headless virtualization foundations [R10, R11] | Ship our own polished ready-made product surface atop selective reuse |

## Positioning hypothesis

“A component system that preserves data meaning and interaction state as the interface adapts—from one primitive to an agent-directed workspace.” This is a statement of intended value, not a proven unique claim. Avoid “first”, “fastest”, “unlimited”, or “better than every competitor.”

## Comparison experiments

E01: build a model comparison view with price units, missing benchmark values and linked selection. E02: revenue exploration across multiple currencies and time grains. E03: resize/adapt while editing, preserving pins/focus. E04: request UI change without naming protocols; distinguish chat-only requests. E05: import only one component and measure actual cost. E06: implement a new domain view without editing core.

For each, compare the existing PoC, a conventional component combination, and relevant competitor only where equivalent functionality/configuration is possible. Measure implementation effort, custom coordination code, semantic errors, task success, UI review, bundle/runtime cost and maintenance burden. Do not penalize a competitor for a feature outside its stated purpose while claiming universal superiority.

## Risks

Metadata burden can outweigh glue-code savings. Custom grammar can create lock-in. Too many components can consume maintenance capacity. Agent routing outside our harness remains probabilistic. Premium boundaries can weaken the OSS adoption proposition. A polished internal demo can hide onboarding failure. Every risk has a corresponding test in product/contract/DX/agent/beta gates.

## Claims policy

Publish only measured configuration-specific improvements. Link raw methodology/results and state missing comparisons. Distinguish official documented capability from our inference and from tested behavior. Refresh competitor facts before an external comparison/pricing launch; this file is a dated design input.
