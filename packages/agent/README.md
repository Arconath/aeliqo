# @aeliqo/agent

Optional agent boundaries for the Aeliqo 0.1.0 rewrite. The package depends on the
pure core and effect-owning runtime; direct components and normal interactions do
not import it. Capability registrations are host-owned and protocol-neutral;
manual, direct and protocol ports all call the same authority-checked dispatcher.

## Capability dispatcher and sessions

`createAgentCapabilityRegistry` accepts only trusted local manifests. A manifest
names one versioned operation grant, a bounded parser and a local handler. Model
or tool input can select an existing reference, but cannot install a handler or
provide actor, approval, principal or grant fields. `createAgentCapabilityDispatcher`
checks fresh host grants, input/output byte limits, cancellation and a
post-handler authority recheck. `experience.commit` and `renderer-ready`
receipts carry an exact region revision; authority changes after a handler yield
an ambiguous `partial` receipt for host recovery.

`createAgentSession` runs one explicit operation at a time with bounded turns,
repairs, bytes and elapsed time. It records runtime-computed fingerprints and
compact attempts, stops repeated candidates, and returns a recovery receipt.
Evaluation (`task.evaluate`/`result.inspect`) and visible presentation
(`experience.propose`/`experience.commit`) remain separate operations. External
MCP, WebMCP and BYOK ports additionally require `model.egress` before returning
result values.

`validateAgentComposition` accepts only the canonical presentation-plan shape,
registered representation and configuration schema references, acyclic reachable
nodes and trusted local configuration checks. It rejects executable code,
remote-module fields and forged authority metadata. The validator does not
execute a query or commit a presentation.

## Structured narrative evidence

`createNarrativeVerifier({readContext, maxRows?}).verify(input)` parses a core
`NarrativeClaim` and resolves its cells from current, host-authorized
`ResultHandle` objects. `readContext` is application code; a wire proposal cannot
supply authority, grants, resolvers, records, or a verified receipt. The independent
`result.inspect` grant is required. The host exposes only the current authorized
handle for an exact result reference.

Value and comparison claims require ready, complete, exact, snapshot-consistent,
observed or computed evidence. Every cell specifies a result revision, output,
query/scope digest, stable row identity, field, semantic type, definition, population,
filters and optional period. The verifier resolves the actual value, uses core
exact scalar comparisons, and rechecks authority and handle state before returning
`verified`. Decimal values retain exact string representation. Null values can be
verified as null; comparisons involving null remain unknown.

The verifier conservatively rejects partial/sample/approximate/inferred evidence.
It does not certify business definitions, user intent, causal interpretation, or
natural-language entailment. `inference` and `hypothesis` always return
`unverified`, regardless of citation presence. A verified receipt is evidence at
verification time; hosts must reverify after authority/result changes before
presenting it and must not treat it as a permission token.

Verification scans at most 100,000 rows by default across both comparison cells;
`maxRows` may be configured from 1 through 1,000,000. It reads existing immutable
batches and performs no data query, action, presentation commit, network request,
or model call. Diagnostics contain no records or host exception text.

## Proposal binding and containment

`createAgentBinder({host, queryLimits?, maxPending?})` validates a serialized
`AgentTaskProposal` using the real Task and query planners. The application
supplies `readContext` with its authenticated principal, independent operation
grants, current catalog/function registry/read set and goal epoch. A model cannot
supply these host fields. Binding returns the formal bound, needs-choice,
needs-meaning, unsupported, denied, invalid or stale outcome; it executes no
query, presentation or business action.

Application decisions about material ambiguity or missing meaning are keyed by
`goalEpoch`, independently of the model's proposed Task identity. Their required
`scope` distinguishes goal-wide decisions from diagnostic decisions; diagnostic
decisions apply only to an exact planner code and path. A successful
binding rechecks host authority after semantic inspection. `bound` means the
proposal is feasible against that context; it does not certify user intent or
business truth and does not replace commit-time authorization.

`containAgentProposal` accepts a binder and optional producer, with explicit
turn, repair, byte and elapsed-time budgets. It stops on repeated candidates
without progress and propagates cancellation to producer and host calls.
Uncooperative cancelled host calls release binder admission slots; late producer
work cannot be forcibly terminated by JavaScript, so providers must honor their
signal too. Supplying a producer does not grant model egress: the application or
future protocol adapter must establish that independent permission before calling
an external model.

The loop returns a receipt and never commits a replacement UI. Existing runtime
region/result ownership preserves the authorized incumbent during failure and
clears revoked data. Applications must use that same authorization boundary for
manual fallback and for any later accepted proposal.
