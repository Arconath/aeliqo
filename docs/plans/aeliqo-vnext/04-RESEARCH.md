# Research and source audit

Research date: 2026-09-19. This document separates observations, recommendations, and evidence that remains to be collected.

## 1. Repository observations

GitHub connector reads established the current `main` SHA as `9092d6cff454b81cd623a7a4be7621c6a750d9c7`. Every repository reference below is pinned to that SHA. The final-v3 audit re-read main through the GitHub connector on 2026-09-19 and obtained the same SHA. No local Aeliqo build, benchmark, browser session, or live-model evaluation was executed for this final revision. Any failed clone recorded in an earlier handoff is historical, not a new result here. That does not invalidate connector source reads, but prevents claims of tested implementation.

Repository base: https://github.com/Arconath/aeliqo/tree/9092d6cff454b81cd623a7a4be7621c6a750d9c7

| ID | Inspected source | Observation | Consequence |
|---|---|---|---|
| R01 | `AGENTS.md` | Five public packages; core/framework independent; runtime/no DOM; Lit web layer; React bindings; bounded agent proposals. Docs under `docs/`. Root Markdown restricted. | Preserve boundaries; place this plan below docs; do not invent a sixth public package or a root PLAN.md. |
| R02 | `package.json` | Version 0.4.2 and scripts for contracts, data, regions, actions, framework consumers, Next SSR, docs, catalog, protocols, security, and multiple performance suites. | Reuse verification suites; do not replace them with one new happy-path test. Script existence is not a pass result. |
| R03 | `packages/runtime/src/app/types.ts` | Runtime options bind ResourceDefinition to DataService. Mount binds regionId to resourceId. Authority is host-owned. | Extend existing seams for typed surface instances and non-data capabilities; avoid a second query or permission engine. |
| R04 | `packages/react/src/app/region.tsx` | Required region/resource IDs; `intent?: unknown`; mount/render through effects; returned JSX is a div container. | Typed convenience API is missing at this boundary. Adaptive initial SSR output must be demonstrated separately, not inferred from an SSR helper. |
| R05 | `packages/web/src/region/types.ts` | Custom view renderer returns Lit TemplateResult or nothing. | Native React rendering needs a real adapter. A registry accepting React components is not already implemented by this type. |
| R06 | `packages/web/src/recipes/standard.ts:185–305` | View eligibility/preference and width affect selection. A candidate returning needs-input is returned immediately rather than always falling through. | Distinguish absent candidate, unsupported semantics, and meaningful ambiguity. Preserve explicit failure and state-transfer behavior. |
| R07 | `packages/agent/src/model/connection-config.ts:34–158` | Explicit egress; current bearer/header credential schemes; explicit tool-call capability; bounded URLs/headers and optional origin allowlist. | Reuse security checks; add any local no-auth mode explicitly. Do not infer universal provider compatibility or accept arbitrary client-controlled URLs. |
| R08 | `tests/performance/bundles.mjs:1–150` | Installed-tarball graph/byte gate. Caps include button/input/metric 15 KiB, table 40 KiB, planner 70 KiB, region-table 160 KiB. Total/excluding-Lit measurement modes are distinct. | Preserve exact existing metric semantics; no silent threshold increases. Add runtime qualification rather than relabel byte gates. |
| R09 | `catalog/components.json:1–90` | Canonical catalog IDs, families, behavioral contracts, and advertised surfaces. | Generate coverage from actual full catalog during execution, not a frozen count from chat. |
| R10 | `AGENTS.md` component section | Contributor guide currently describes 71 authored component pages; actual inventory must be recounted. Each needs runnable example, generated API facts, behavior, states, accessibility, responsive and performance notes. | Every public component gets its own checked page and executable examples. A catalog component is not automatically an adaptive candidate. |

Pinned path URLs follow this pattern:
`https://github.com/Arconath/aeliqo/blob/9092d6cff454b81cd623a7a4be7621c6a750d9c7/<path>`.

Read `quality/commands.json`, complete export maps, all scoped AGENTS files, current branch rules, and the actual release workflows during T00. They are execution inputs, not claimed fully audited here. The 0.4-specific release steps and branch names in AGENTS.md are historical release-line instructions; vNext needs a deliberate superseding decision, not reuse of version 0.4.2 for breaking changes.

## 2. Primary external sources

These are design precedents, not proofs that Aeliqo has the same properties. Summaries are intentionally narrow.

### S01 — React external stores
https://react.dev/reference/react/useSyncExternalStore

External stores require stable snapshots and correct subscription cleanup; SSR needs a matching server/client initial snapshot. Apply this to selector subscriptions, request-scoped data, Strict Mode, and hydration tests. Do not put all surface state in one frequently changing Provider value.

### S02 — TanStack headless separation
https://tanstack.com/table/latest/docs/overview

TanStack separates table logic from markup/style and framework adapters. Adopt the separation principle, not another mandatory table dependency or a claim about identical performance.

### S03 — Radix composable primitives
https://www.radix-ui.com/primitives/docs/overview/introduction

Composable UI primitives and incremental adoption are relevant to low ceremony without global takeover. Use composition for toolbar/status/confirmation, not a giant component with unrelated boolean flags.

### S04 — json-render registry boundary
https://json-render.dev/docs/registry

Catalog definitions and platform-specific renderer implementations are separate. Aeliqo should retain its own validated intent and presentation semantics rather than equating generative component selection with deterministic adaptation.

### S05 — Astro islands
https://docs.astro.build/en/concepts/islands/

Interactive regions can coexist with server/static content. Use this as an integration requirement: no mandatory whole-page client runtime or hydration for unrelated content. A new Astro package is not required; prove an embedding recipe.

### S06 — Ollama OpenAI compatibility
https://docs.ollama.com/api/openai-compatibility

Compatibility is endpoint/feature dependent. Local endpoints can differ from hosted APIs, including authentication expectations and optional behaviors. Provider-agnostic support needs a capability profile and conformance matrix rather than a universal promise.

### S07 — OWASP authorization
https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html

Authorization should default to denial and be checked for each relevant request. Client UI capabilities are not server permission grants. Recheck at execution, including after confirmation or policy changes.

### S08 — W3C APG
https://www.w3.org/WAI/ARIA/apg/

APG documents accessibility patterns, semantics, keyboard interaction, and examples. Use it to guide component contracts and manual keyboard/focus tests. Automated accessibility checks do not establish comprehensive conformance by themselves.

### S09 — Web Vitals
https://web.dev/articles/vitals

LCP, INP, and CLS provide page-level experience metrics. Current good thresholds are LCP <=2.5 s, INP <=200 ms, CLS <=0.1 at the 75th percentile. Framework microbenchmarks are not field Web Vitals measurements; label lab and field evidence separately.

### S10 — AG-UI
https://docs.ag-ui.com/introduction

AG-UI provides agent/application event interoperability. Keep protocol integration at an optional adapter boundary; do not import a protocol's unrestricted state patches directly into trusted application state. Implementing a new AG-UI adapter is not a prerequisite for this release.

### S11 — Codex AGENTS.md
https://developers.openai.com/codex/guides/agents-md

Official URL currently redirects to ChatGPT Learn documentation. Codex discovers layered AGENTS guidance. Keep the repository guide concise and point to the execution plan, rather than pasting the entire spec into instruction files.

### S12 — Codex execution plans
https://cookbook.openai.com/articles/codex_exec_plans

Official article describes self-contained living execution plans with progress, decisions, discoveries, and verification. Use that approach to prevent context loss across a large change. It does not guarantee unattended completion or remove review/authorization gates.

### S13 — Codex non-interactive prompt input
https://developers.openai.com/fr-FR/docs/non-interactive-mode

The official documentation describes `codex exec -` for reading the complete prompt from stdin. Verify installed CLI help and permissions before use. No bypass flags are part of this pack.

## 3. Alternatives evaluated

**Universal JSX component.** Good demo brevity; poor separation between read data, mutations, model credentials, render policy, lifecycle, and global coordination. Rejected as the primary public API.

**Mandatory large feature DSL for everything.** Explicit but turns a small component into an infrastructure project; risks recreating routes, state managers, and ORMs. Rejected as the only entry path.

**Headless surface controller plus composable render adapters, backed by existing contracts.** Selected. Data convenience hooks and advanced feature bindings return the same controller contract. Built-ins remain useful immediately; host UI, backend, and model integration remain optional seams.

## 4. What is not validated yet

vNext compilation, runtime performance, heap behavior, every component's actual accessibility, live model task quality, user research, registry publication, and production deployment remain untested in this planning task. The full-plan acceptance matrix defines how to establish each claim. Missing evidence must remain visible; tests of a mock provider are not live-provider evidence.

No external source establishes that Aeliqo can serve every possible application or unlimited traffic. The engineering target is bounded overhead, explicit limits, modular adoption, and published tested profiles.

## 5. Final-v3 revalidation and references

The v2 SPEC, EXECPLAN, ACCEPTANCE, prompt, guide, addendum, research and checkpoint were read in full, and the original ZIP hashes were checked. See `09-AUDIT.md` for concrete contradictions and their replacements. Final-v3 modifies the normative documents together rather than appending rules that contradict their examples.

Primary sources re-read on 2026-09-19:

- React external-store snapshot/hydration and lazy/Suspense caveats: https://react.dev/reference/react/useSyncExternalStore
- React effect/ref replay in StrictMode: https://react.dev/reference/react/StrictMode
- TanStack Query identity/dependency keys: https://tanstack.com/query/latest/docs/framework/react/guides/query-keys
- OWASP multi-tenant context, cache partitioning and membership checks: https://cheatsheetseries.owasp.org/cheatsheets/Multi_Tenant_Security_Cheat_Sheet.html
- Ollama protocol/feature compatibility: https://docs.ollama.com/api/openai-compatibility
- W3C APG and WCAG 2.2: https://www.w3.org/WAI/ARIA/apg/ and https://www.w3.org/TR/WCAG22/
- Platform renderer registry separation: https://json-render.dev/docs/registry
- Existing components operated via language: https://docs.tambo.co/concepts/generative-interfaces/interactable-components
- Codex persistent execution plans: https://developers.openai.com/cookbook/articles/codex_exec_plans
- Codex layered instructions: https://developers.openai.com/codex/guides/agents-md

These sources support the separation of concerns and verification choices, not a proof of universal optimality. In particular, tenant selectors are not credentials; useSyncExternalStore snapshots must remain stable and match initial SSR data; provider compatibility requires actual feature profiles. No new dependency on these comparison products is prescribed.
