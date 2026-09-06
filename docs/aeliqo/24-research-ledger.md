# 24 — Research ledger

Accessed 6 September 2026. Primary sources only. Product/architecture decisions are our proposals, not endorsements by these sources. Rolling documentation may change; pin actual tested dependencies/protocols in the local project. No source proves Aeliqo performance or demand.

## R01 — OpenAI — Build skills

Source: <https://developers.openai.com/codex/build-skills>

Used for: Repo-local .agents/skills discovery, front matter, implicit matching and duplicate-name behavior.

## R02 — OpenAI — Codex MCP

Source: <https://developers.openai.com/codex/mcp>

Used for: STDIO/Streamable HTTP, scoped configuration and server instructions; host-specific behavior.

## R03 — OpenAI — AGENTS.md

Source: <https://developers.openai.com/codex/agent-configuration/agents-md>

Used for: Scoped instruction discovery for development sessions.

## R04 — MCP — Tools, revision 2026-07-28

Source: <https://modelcontextprotocol.io/specification/2026-07-28/server/tools>

Used for: Tools are discoverable/model-controlled; protocol does not prescribe a universal UX.

## R05 — Chrome — WebMCP

Source: <https://developer.chrome.com/docs/ai/webmcp>

Used for: Experimental/proposed API, origin trial/local testing and browser requirements.

## R06 — JSON Schema — draft 2020-12

Source: <https://json-schema.org/draft/2020-12>

Used for: Schema dialect reference; not a business-semantic validator.

## R07 — Ajv — Standalone validation

Source: <https://ajv.js.org/standalone.html>

Used for: Build-time generated validators; implementation must configure and test actual generated output.

## R08 — React — useSyncExternalStore

Source: <https://react.dev/reference/react/useSyncExternalStore>

Used for: Stable external snapshots/subscription and transition caveats.

## R09 — D3 — Getting started

Source: <https://d3js.org/getting-started>

Used for: Modular visualization and React/DOM ownership considerations.

## R10 — Ark UI

Source: <https://ark-ui.com/>

Used for: Headless behavior/component foundation candidate, not proof of our own accessibility.

## R11 — TanStack Virtual — Introduction

Source: <https://tanstack.com/virtual/latest/docs/introduction>

Used for: Headless virtualization; does not ship our markup/design.

## R12 — TC39 — ECMA-402 NumberFormat

Source: <https://tc39.es/ecma402/#numberformat-objects>

Used for: Formatting API; no application FX-data service provided by number formatting.

## R13 — MDN — CSS container queries

Source: <https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Containment/Container_queries>

Used for: Container-relative CSS responsiveness and containment behavior.

## R14 — web.dev — Optimize INP

Source: <https://web.dev/articles/optimize-inp>

Used for: p75 200 ms guidance and interaction-latency decomposition; not per-component certification.

## R15 — W3C — WCAG 2.2 quick reference

Source: <https://www.w3.org/WAI/WCAG22/quickref/>

Used for: Accessibility requirements; manual review and actual conformance remain necessary.

## R16 — Playwright — Accessibility testing

Source: <https://playwright.dev/docs/accessibility-testing>

Used for: Automated checks and limitations versus full accessibility evaluation.

## R17 — fast-check — Model based testing

Source: <https://fast-check.dev/docs/advanced/model-based-testing/>

Used for: Command/model testing approach for stateful sequences.

## R18 — Astro — Starlight

Source: <https://starlight.astro.build/>

Used for: Documentation-site foundation candidate.

## R19 — json-render — Documentation

Source: <https://json-render.dev/docs>

Used for: Catalog/registry/spec-based UI overlap.

## R20 — Tambo — Generative user interfaces

Source: <https://docs.tambo.co/concepts/generative-interfaces>

Used for: Registered generative component/interface overlap.

## R21 — AG Grid — AI Toolkit

Source: <https://www.ag-grid.com/javascript-data-grid/ai-toolkit/>

Used for: AI/grid-state integration overlap.

## R22 — MUI X — AI Assistant

Source: <https://mui.com/x/react-data-grid/ai-assistant/>

Used for: Prompt-driven grid operations overlap.

## R23 — A2UI — Catalogs

Source: <https://a2ui.org/concepts/catalogs/>

Used for: Declarative UI catalogs/interchange design.

## R24 — CopilotKit — AG-UI

Source: <https://www.copilotkit.ai/ag-ui>

Used for: Agent/frontend interaction and state protocol positioning.

## R25 — WebMCP Auto-UI — Architecture

Source: <https://jeanbaptiste.github.io/webmcp-auto-ui/guide/architecture/>

Used for: Agent/canvas/registry architecture overlap; not independently benchmarked.

## R26 — Apache Software Foundation — License 2.0

Source: <https://www.apache.org/licenses/LICENSE-2.0>

Used for: Copyright/patent/notice/license terms; existing code compatibility needs review.

## R27 — MUI X — Licensing

Source: <https://mui.com/x/introduction/licensing/>

Used for: Open-core community/commercial packaging example.

## R28 — AG Grid — License and pricing

Source: <https://www.ag-grid.com/license-pricing/>

Used for: Community/enterprise commercial packaging example; no prices copied as fixed truth.

## R29 — Vega-Lite — Overview

Source: <https://vega.github.io/vega-lite/docs/>

Used for: Established compositional visualization grammar.

## R30 — OpenAI — Using skills to accelerate OSS maintenance

Source: <https://developers.openai.com/blog/skills-agents-sdk>

Used for: Repo policy + local skills + verification workflow; not an automation guarantee.

## R31 — React — Preserving and resetting state

Source: <https://react.dev/learn/preserving-and-resetting-state>

Used for: State tied to render-tree position; keys not universal reparenting preservation.

## R32 — MCP — Streamable HTTP, revision 2026-07-28

Source: <https://modelcontextprotocol.io/specification/2026-07-28/basic/transports/streamable-http>

Used for: Transport revision reference; pin SDK/client compatibility rather than assume universal support.

## Internal context

The user-provided framework blueprint v1, dated 5 September 2026, was read in full from the user Library. Its architectural/business proposals are preserved where consistent with the latest request. Shared conversation URL could not be fetched. Actual PoC source was not available; G0 performs local reconciliation. No third-party source text is bundled or copied extensively.
