# 12 — Agent routing, MCP, BYOK and WebMCP

## The product problem

Tools available to a harness are not a deterministic instruction router. MCP exposes discoverable tool metadata and schemas; the model/host decides when to use them. Codex supports server-wide MCP instructions in its documented host configuration, but other clients may differ. A repository AGENTS.md applies to development sessions that load it, not to arbitrary end-user agents. [R02, R03, R04]

The user should not repeat “use MCP/Aeliqo” for ordinary work inside an already bound workspace. Achieve that through contextual intent routing, useful tool descriptions, server instructions, result contracts and evaluations. Do not promise 100% behavior across untested models/harnesses.

## Two control environments

**Owned harness:** the application knows the active workspace/output surface, registers tools, classifies the requested outcome, validates tool plans and checks final completion. It can select/require tools where its provider interface supports that. It must still honor explicit chat-only requests and approvals. An outcome checker rejects a chat-only answer for a UI task and retries/reports the issue within bounded policy.

**External harness:** Aeliqo controls server metadata, tools and receipts, not the model's system prompt, final text, or tool-selection algorithm. Supply compact initialization/server instructions, explicit tool examples, workspace state and recoverable errors. Test specific host/model/settings combinations. Report routing quality as observed, not guaranteed. Avoid making unsupported claims that tool logs reveal all user intents or missed invocations.

## Routing categories

| Request/context | Expected route |
|---|---|
| “Change the React component source” in local repo | Development tools; not a live UI mutation |
| “Plot this in the current workspace” with one bound target | Query/plan/apply; verify UI outcome |
| “Explain this metric, chat only” | Read if needed; no UI mutation |
| “Compare these” from a selected workspace panel | Prefer workspace outcome using scoped selection; chat summary secondary |
| “Compare these” with no workspace context | Clarify output/target or answer text as appropriate; do not invent a target |
| Several eligible tabs/workspaces | Resolve/prompt for a target; no cross-tab guessing |
| Unsupported metric/component/query | Explain capability gap; no fake success or arbitrary code generation |

## Small default tool surface

`workspace_inspect`: discover authorized/bound workspaces, selected entities, revision, pins, capability summary and specific request status. `catalog_search`: find relevant dataset/component/action descriptors with bounded pagination. `data_query`: authorized data read; returns scope/provenance and bounded rows/aggregates, **not a UI change**. `workspace_apply`: validate and apply either a structured semantic intent or explicit operation batch; returns honest normalized receipt. Business actions get their own explicit tools only when enabled, not hidden in generic UI apply.

Do not expose 120 tools for 120 components. Catalog IDs + typed params provide extensibility. Conversely, avoid one tool taking arbitrary natural-language text that runs a second hidden agent. Most planning should be a single structured intent lowered by deterministic runtime rules, with explicit operations available for precise control.

## Suggested server instructions

> For a user-requested change to a bound Aeliqo workspace, use workspace tools and verify the returned outcome. data_query only reads data. Do not replace a requested UI change with a chat table. Respect chat-only/explanation requests. Inspect ambiguous targets. Never call an outcome completed while render/data are pending, failed, or disconnected. Preserve user pins and newer edits.

Keep the most important guidance self-contained at the beginning. Codex documentation advises a self-contained first 512 characters for MCP instructions. This is host-specific guidance, not a cross-protocol size limit. [R02]

Tool descriptions must explain when to use, when not to use, target/side effects, and success semantics. Include examples such as visualize/filter/sort/drill/arrange without requiring protocol words in user prompts. `data_query` describes its non-presenting nature, but returning rows is still allowed for actual analysis/chat requests.

## MCP-to-browser bridge

MCP access alone cannot mutate a random browser tab. The app includes an authenticated browser link to the runtime. Local development may use a loopback companion started via STDIO; hosted deployment can use Streamable HTTP plus an application-owned authenticated browser channel. WorkspaceId/rendererId/routing identity are independent of protocol connection/session IDs. Pin official SDK and client compatibility rather than hand-writing protocol assumptions. [R02, R04]

Pair explicit origin/principal/workspace/renderer; show connected status and allow revoke/disconnect. Multiple tabs, hidden tabs, reconnect, origin mismatch, expired pairing, permission revocation and replay are mandatory tests. Loopback is not an excuse to omit origin checks, pairing or message size bounds. Provider secrets never enter the browser bundle.

## WebMCP

Optional separate adapter, feature detection and lifecycle registration/cleanup. It calls the same dispatcher, not a second UI implementation. Chrome documentation at research time describes a proposed standard, origin trial/local flag, origin isolation and tools Permissions Policy, with discovery requiring visiting the page. Browser/host support remains explicit and experimental. [R05]

Do not fake compatibility using an identically named JavaScript object. A missing API gives a clear unsupported state; ordinary UI and MCP path still work. Site-tool schema/features are compiled to the actual supported browser API version and tested. A desktop agent exposing site tools does not imply every installed browser or agent supports them.

## BYOK and MCP Apps

BYOK is optional inference, not a separate semantic runtime. Use a server/local-companion provider adapter with cancellation/cost limits; UI remains usable if the provider fails. Keys are never stored in client localStorage or echoed into receipts. MCP Apps, when considered later, is an embedded host UI target, not a substitute for the app's browser bridge. Keep it out of initial scope unless required by a concrete deployment.

## Tests and success claim

Run `evals/routing-cases.jsonl` with explicit outcome oracles: workspace revision/selected entities/query scope/render/data correctness, not exact tool sequence or final wording. Include chat-only negatives and no-target/disconnect/conflict. A mocked dispatcher test does not establish real external-model routing. Record client/model/settings/date, trials, success and failure types. A public reliability claim requires end-to-end runs on declared supported configurations and a withheld test set.
