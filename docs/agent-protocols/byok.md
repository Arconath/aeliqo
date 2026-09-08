# Application-owned BYOK model port

`@aeliqo/agent/model` exports `ToolModelPort` and `runToolModel`. The model port
only counts input tokens and proposes text/function calls. Every proposed call
uses the same registered capability dispatcher as the manual, MCP and WebMCP
paths. The loop contains no query evaluator or provider-specific planner.

Create an expiring `createAgentToolEndpoint` from `@aeliqo/agent/protocol` with
`transport: 'byok'`, an explicit region/goal/principal, trusted host authority,
and the capability registry. Pass that endpoint, the host-approved prompt,
`goal: 'chat' | 'experience'`, and an explicit `ToolModelBudget` to the loop.
No page contents, host context, catalog, records or credentials are collected
automatically. Authorized capability results become bounded tool messages.

The loop checks current model egress before token counting, before generation,
after generation, and around tool calls. Token counting may itself contact a
provider. Separate operation grants still control evaluation, meaning activation,
presentation and business actions. A changed principal, goal or authorization
scope stops the loop. Model quality has no effect on those checks.

Budgets limit turns, model requests (counting included), tool calls, elapsed time,
input/output/total generation tokens, request/response bytes and repeated calls.
Input counting plus reserved maximum output tokens must fit before generation.
Provider-reported usage is checked afterward. These limits bound request and
token consumption; the application owns provider pricing and a monetary spend
limit. No SDK retry is enabled in the reference port. Cancellation propagates to
the provider and tool boundary, but cannot undo an already completed remote
request or business transaction. Inspect partial/recovery capability receipts.

A chat completion returns `textDraft`; it is unverified prose, not a validated
numerical narrative. Apply the existing claim/evidence policy before presenting
it as a fact. An experience request finishes successfully only with an actual
`renderer-ready` capability receipt. A model saying it updated the screen yields
`no-commit`. Renderer readiness identifies the committed region revision; it
does not certify browser paint or human attention.

## Optional official OpenAI reference

`@aeliqo/agent/model/openai` exports `createOpenAIToolModel`. Install the exact
optional `openai` peer version recorded in the agent package, create the official
SDK client on a trusted server, and supply an explicit model ID. The reference
uses Responses function tools and input-token counting, disables retries,
parallel tool calls, truncation, storage and streaming, and passes full bounded
function-call/output correlation on every turn. Other providers implement the
normalized port rather than replacing the semantic executor.

The default agent, protocol and model entries do not import a provider SDK.
The OpenAI entry rejects browser execution. API keys belong to the host-created
SDK client and are never placed in tool arguments, returned receipts or logs.

The official SDK HTTP exchange is tested against a local protocol fixture.
Synthetic model tests cover containment, permissions, cancellation and budgets.
Neither establishes real natural-language reasoning or live provider support.
The actual credentialed, budget-authorized held-out evaluation remains T40.
