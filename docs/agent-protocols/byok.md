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

## OpenAI-compatible Responses transport

`@aeliqo/agent/model/responses` supplies
`createOpenAICompatibleResponsesToolModel` for a trusted server that owns an
OpenAI-compatible Responses endpoint. It is deliberately provider-agnostic:
applications configure the HTTPS base endpoint, explicit model ID, opaque
credential reference, credential resolver, and request policy independently. The
transport never selects a provider or model from credential contents, a reference
format, or an endpoint hostname.

The resolver receives the opaque reference and an abort signal, and returns a
credential only within the server request. Credentials, authorization headers,
endpoint URLs, and provider response bodies are never placed in a model receipt or
transport error. The request policy requires `maxRetries: 0`, explicit timeout and
byte limits, and `stream: false`. The transport performs no retry itself. Caller
cancellation and timeout reach credential resolution and `fetch`; an already
completed remote request cannot be undone.

It implements `responses/input_tokens` counting and non-streaming
`responses` completion with Responses function-call proposals. `ToolModelPort`
does not expose streaming events and this transport does not buffer or emulate
them; a request policy that enables streaming is rejected. Parsed tool proposals
remain untrusted and must pass `runToolModel` plus the same capability/egress
boundary as every other BYOK port. This local protocol compatibility is not proof
that a provider has been evaluated for task quality or that every
OpenAI-compatible endpoint implements the same optional features.
