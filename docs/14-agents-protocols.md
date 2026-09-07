# 14 — Agent capabilities: one execution path

## Model and transport are different

MCP/WebMCP expose application capabilities to an agent. BYOK is an application-owned connection to a model service. Neither MCP nor WebMCP is itself the reasoning model. Manual/programmatic tasks must call the same validated dispatcher as all agent paths.

The official Chrome imperative API documentation currently uses `document.modelContext.registerTool`, registration cancellation via AbortSignal, and explicitly describes evolving support. Keep feature detection and native evidence separate from fake-host tests. [S16]

## Small tool surface

Use a few intent-level capabilities with bounded progressive discovery:

- `catalog`: paginated authorized summaries/details and relevant component/profile capabilities.
- `task`: propose/bind/inspect/execute/cancel a typed task, with explicit target and request identity.
- `meaning`: inspect/propose/preview/publish only within the user's authoring scope.
- `experience`: inspect/suggest/apply an approved view change and recover its receipt.
- `action`: discover/propose/confirm/execute authorized business actions only where enabled.

These are conceptual groupings, not a license to hide dozens of side effects behind one ambiguous schema. Generate concrete operation schemas and descriptions from contracts; keep reads and consequential operations clearly distinct. Tools may be split when needed for safe discoverability, but semantics and handlers are shared.

## Model contribution

The LLM may interpret language, resolve existing semantic vocabulary, propose a bounded expression, choose a useful investigation path, request clarification, and propose task/view constraints. It may iterate after a validation error with structured feedback. It does not execute mathematical business calculations, fetch arbitrary endpoints, generate executable UI, or decide low-level pixel styling.

Do not amputate intelligence by forcing the model to a brittle keyword-to-chart switch. Do not inflate it by making every resize/selection a model request. The runtime is deterministic given accepted proposals and data/environment versions.

## Agent loop

Bound turns, wall time, input/output bytes, query/model cost and concurrent tool calls. Preserve request IDs across tool retries, but do not assume generic exactly-once execution. Abort propagates. A text answer can satisfy a chat-only request; a request to change the interface requires an actual committed/renderer-ready experience receipt or an explicit failure.

Progress exposes compact stages (understanding, preparing data, updating view), with optional inspector logs. A synthetic provider is labeled synthetic and cannot establish natural-language capability.

## MCP

Use the official SDK; support local stdio and the supported remote transport only after auth/session tests. Local pairing binds one explicit workspace/region and expires/revokes; do not choose the last-connected browser tab. Multi-tenant remote sessions use application auth and origin/audience checks. Secrets never travel in tool arguments or shareable query strings.

## WebMCP

Feature-detect the actual native API and negotiate capabilities. Tool registration/disposal follows documented lifecycle; cancelled/disposed regions reject late calls. A missing native host disables only this optional transport. There is no secret browser-automation fallback presented as WebMCP.

Publish separate evidence states: adapter contract tested; simulated host tested; native host tested (browser/version/date). Native tests must run in a real supported host; ordinary Playwright Chromium support is not assumed. Experimental status remains visible even when simulations pass.

## BYOK

Define one normalized `ToolModelPort` for the application to provide model calls/stream events. Ship a small tested reference implementation using a currently supported official provider SDK on a trusted server. Other model providers integrate through this port; do not create a provider-specific planner or promise all OpenAI-compatible endpoints implement identical semantics.

Provider credentials are server/environment-owned. Direct in-browser keys are not a recommended default. Model selection/cost belongs to application configuration, not to the core component API. Core/browser bundles exclude provider packages unless a specific appropriate entry is intentionally imported.

## Receipts

Report accepted, bound, data-ready, plan-committed, renderer-ready, cancelled, partial and failed stages separately. A renderer-ready acknowledgement names the exact region revision and affected data handles; it is not proof of browser paint or human attention. Pending work can be inspected by request ID. Timeouts after side effects are not silently called failures that are safe to retry.

## Evaluation

Run identical normalized tasks through direct, MCP, WebMCP adapter and BYOK tool loop; compare semantic plans/results/receipts, not wording. Then run real held-out natural-language tasks through a paid provider with authorized budget, an actual MCP client and native WebMCP separately. Log exact environment and sanitized evidence. Missing provider credentials or host support is BLOCKED rather than PASS.

## Master consolidation proposer and investigator, not a keyword parser

Allow high-level reasoning, scoped structured expression/query proposals, registered view/composition proposals, semantic-gap resolution and evidence-grounded explanations. Do not ban an agent from mentioning a concrete component merely because the deterministic compiler can choose one too. Model output is a candidate, not a trusted evaluator or unchecked command.

Evaluate/inspect and present/commit are separate tools/effects. The agent may ask several bounded analytical questions while preserving the user's current screen, then present the useful result once. A user can inspect progress/cost; do not describe reads as invisible work. Stop on task completion, budget, capability gap or new user instruction. Prefer a concise actionable clarification when meaning would materially change.

External MCP/WebMCP reasoning does not automatically re-enter a BYOK model. Tool handlers expose the same deterministic capabilities, while the chosen agent host owns reasoning. No provider-specific semantic planners. A model sees only authorized metadata, bounded summaries and, when needed and permitted, records/text. Metadata-only cannot be advertised as sufficient for all free-text questions.

Numerical/textual claims cite result/output/version/definition/scope references. Distinguish computed observation, model inference and causal hypothesis. Counterexamples such as a changing population mixture must be part of evaluation. Do not expose chain-of-thought as evidence; concise decisions and tool/result traces suffice.

As retrieved September 7, 2026, official MCP docs use version 2026-07-28 and Chrome documents `document.modelContext`; adapters must pin/test negotiated versions rather than assume an old handshake or an unverified future one. Protocol docs do not prove support in the user's installed client. [R11, R12]

## Master edition 1 — canonical references

Use chapter37 for formal binder outcomes, model-failure recovery and host-owned independent grants. Model quality cannot widen permissions. The reference agent-boundary types and Python probes are not the production validator: T41implements the contract and T40runs actual model evaluation.

[Master](../MASTER-SOT.md) · [AI contract](37-model-failure-containment.md) · [Release](18-release-migration.md).
