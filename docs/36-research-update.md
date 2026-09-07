# 36 — Master consolidation primary research and decision boundary

Research date: **7 September 2026**. These are primary sources checked during Master consolidation preparation. They support mechanisms and limitations, not a claim of unprecedented invention, universal optimality, finished implementation, product-market fit or measured production speed.

The R-prefixed references below update the original S-prefixed research in chapter 24. Read sources selectively for the task at hand; do not load every source into every agent packet.

| ID | Primary source | Design implication / limit |
|---|---|---|
| R01 | [A2UI catalogs](https://a2ui.org/concepts/catalogs/) | Catalog-constrained declarative UI is existing prior art. Aeliqo must prove additional semantics, query and task-preserving interaction value rather than claiming all agent UI is new. |
| R02 | [json-render documentation](https://json-render.dev/docs) | Schema/catalog-driven generated UI exists. Aeliqo owns complete components and the governed data-to-experience boundary; do not claim zero competitors. |
| R03 | [Tambo generative components](https://docs.tambo.co/concepts/generative-interfaces/generative-components) | Registered generative components and interactable application surfaces are prior art; compare equivalent tasks rather than feature names. |
| R04 | [Vega-Lite composition](https://vega.github.io/vega-lite/docs/composition.html) | Layer/facet/concat/repeat are established compositional mechanisms. Combined domains still need semantic checks. |
| R05 | [Vega-Lite parameters](https://vega.github.io/vega-lite/docs/parameter.html) | Selections, filter transforms and scale-domain changes are distinct; Aeliqo should not conflate view extent with query population. |
| R06 | [Draco constraints API](https://dig.cmu.edu/draco2/api/draco.html) | Hard/soft constraints support validation and ranking, but do not prove a universal best UX or empirically optimal Aeliqo scores. |
| R07 | [Substrait specification](https://substrait.io/spec/specification/) | Engine-independent compute plans are prior art. Use a small Aeliqo logical subset without importing an entire federation engine into the browser. |
| R08 | [OpenAPI specification](https://spec.openapis.org/oas/latest.html) | API descriptions enumerate shape/operations; parsing one does not create backend aggregation, permissions, domain semantics or pagination correctness. |
| R09 | [Standard Schema](https://standardschema.dev/) | Validation interoperability and JSON Schema conversion are distinct contracts; inspectable metadata must actually exist. |
| R10 | [Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs) | Schema conformity does not eliminate mistakes. Validate semantic meaning and task outcomes beyond parser success. |
| R11 | [MCP architecture 2026-07-28](https://modelcontextprotocol.io/docs/2026-07-28/learn/architecture) | Protocol context/tool exchange is distinct from model reasoning. Negotiate supported protocol versions; no mandatory nested model invocation for external-agent calls. |
| R12 | [Chrome WebMCP imperative API](https://developer.chrome.com/docs/ai/webmcp/imperative-api) | The fetched documentation uses document.modelContext.registerTool with abort-aware lifecycle. Experimental native support must be tested, not inferred from a simulated host. |
| R13 | [Lit SSR overview](https://lit.dev/docs/ssr/overview/) | Lit SSR is experimental Labs functionality. Early production consumer proof is mandatory; missing SSR/browser validation is not a pass. |
| R14 | [Lit React integration](https://lit.dev/docs/frameworks/react/) | Thin property/event wrappers can reuse custom elements; actual controlled values, SSR, refs and cleanup remain Aeliqo tests. |
| R15 | [WCAG 2.2 Reflow understanding](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html) | Essential two-dimensional content has a bounded reflow exception. Do not hide comparison relationships merely to avoid horizontal scroll. |
| R16 | [WAI-ARIA APG patterns](https://www.w3.org/WAI/ARIA/apg/patterns/) | Reference keyboard/focus/semantic control patterns. Automated tests do not replace real assistive-technology review. |
| R17 | [Web Vitals](https://web.dev/articles/vitals) | Whole-page field metrics and percentile thresholds differ from library planner benchmarks. Measure both honestly. |
| R18 | [Optimize long tasks](https://web.dev/articles/optimize-long-tasks) | Break/yield expensive work; avoid blocking interaction. Worker or scheduler abstraction must be justified by measured workloads. |
| R19 | [Playwright visual snapshots](https://playwright.dev/docs/test-snapshots) | Screenshot baselines vary by OS/browser/fonts and environment; pin/reference each environment and review meaningful diffs. |
| R20 | [DTCG format 2025.10](https://www.designtokens.org/tr/2025.10/format/) | Token interchange is a community specification; using it is not claiming Aeliqo is a W3C industry standard. |
| R21 | [PostgreSQL transaction isolation](https://www.postgresql.org/docs/18/transaction-iso.html) | Snapshot consistency depends on transaction/isolation semantics; multiple reads cannot claim a global snapshot by default. |
| R22 | [PostgreSQL row security](https://www.postgresql.org/docs/current/ddl-rowsecurity.html) | Host-enforced row policy is distinct from client UI filtering. Aeliqo discovery and execution must honor actual application authority. |
| R23 | [OWASP LLM prompt injection prevention](https://cheatsheetseries.owasp.org/cheatsheets/LLM_Prompt_Injection_Prevention_Cheat_Sheet.html) | Treat source text as untrusted data, enforce capability/egress bounds and review side effects; a system prompt alone is not access control. |
| R24 | [npm unpublish policy](https://docs.npmjs.com/policies/unpublish/) | Published name/version pairs cannot be overwritten or reused after unpublishing. Release new unused versions and migrate explicitly. |
| R25 | [npm trusted publishing](https://docs.npmjs.com/trusted-publishers/) | OIDC-based publication requires supported account/CI configuration. Do not invent current project credentials or publisher setup. |
| R26 | [OpenAI subagents](https://developers.openai.com/codex/subagents) | Subagents can have model/effort and role controls. Verify actual local Astra Medium/Luna Max availability and effective settings. |
| R27 | [OpenAI configuration reference](https://developers.openai.com/codex/config-reference) | Fetched config documents agents.default_subagent_model, default_subagent_reasoning_effort and max_concurrent_threads_per_session. Client-specific support still must be verified. |
| R28 | [OpenAI harness engineering](https://openai.com/index/harness-engineering/) | Use repository documentation, concise entry instructions, mechanical boundaries and observable tests; avoid giant repeated context dumps. |

## What research changed

Keep the four-contract architecture. Make patterns optional, accept bounded AI composition proposals, preserve independent query/presentation and evaluate/present boundaries, and explicitly carry grain/population/evidence across outputs. Use one shared web implementation with a blocking real SSR/a11y spike. Do not claim no competitors: A2UI/json-render/Tambo and declarative visualization systems overlap parts of this space.

The distinguishing hypothesis is **task-preserving, evidence-grounded adaptive application UI over data and domain meaning**, with Aeliqo-owned components and direct manual use. Prove that hypothesis with equivalent-user-task tests, not architectural names.

## Runtime and research uncertainty

Official URLs can redirect as documentation evolves. Exact versions, model IDs and configuration support must be recorded from the installed client. Current documentation lists specific agent keys, but a generated TOML is not proof of effective session configuration. The requested model policy is unchanged; Max is not silently replaced with another effort.

The container's npm request failed DNS resolution. Web documentation was retrieved, but no fresh package installation, Lit SSR/browser proof, real model test or deployment was performed. Master consolidation tests cover the harness, reference types/guards and independent numerical/search experiments only. See [validation](../VALIDATION.md).

## Current-source register

This inherited register records earlier design research. The current preparation's primary-source checks and decision limits are consolidated in [40-current-research.md](40-current-research.md). A retrieved third-party documentation claim is not proof of the installed local runtime or Aeliqo implementation. MASTER-SOT.md and current release chapter supersede historical version assumptions.
