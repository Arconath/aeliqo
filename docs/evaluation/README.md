# Evaluation execution status

T40 is not accepted. No live model score is recorded by this directory.

`tests/agent-evaluation/host.ts` is a synthetic application host around the
production evaluator, Result store, cohort resolver, and capability dispatcher.
It exposes scoped catalog read and data evaluation through the same tool endpoint
used by the protocol/model adapters. Its independent host grants do not expose
presentation commit, meaning activation, or business execution. It records
observable tasks, result descriptors/rows, diagnostics, and execution intervals;
it does not record private reasoning. Oracle answers never enter tool context.

The initial development tests establish exact explicit-task/dispatcher parity,
wire-authority rejection, revocation, and stale-goal denial. These deterministic
tests are harness validation, not AI performance or T40 release acceptance.

The sealed data-query corpus in `fixtures/evaluation` contains 18 cases across
HR, commerce and support, with 21 named outputs. Independent Python arithmetic
and quality reports are preserved beside it. The integrated explicit baseline
passed 18/18 at source `6e0ed7c`; its frozen report is in
`harness/evidence/t40/6e0ed7c-explicit-preflight`. The implementation author did
not inspect the sealed prompts, source rows or expected answers.

Still required: independently accepted full held-out coverage; owner-selected exact
weak/strong model configurations and explicit spend ceiling; bounded live trials
through the official model adapter; external MCP-host reasoning trials; first-attempt and
recovery scores; arithmetic/scope/grounding oracles; UI task completion and
ablation results. Report unavailable credentials, incomplete UI observation,
unreviewed prose, or missing cost data as blocked/unmeasured. Never substitute
scripted replies or successful schema validation for a model-quality score.

## Bounded data-only preflight

The Node entry is `node tests/agent-evaluation/run.mjs --corpus CORPUS.json
--output OUTPUT_DIRECTORY`. Without `--live`, it runs explicit tasks only and
never opens a provider connection. Exit 2 and `status: blocked` are deliberate:
the data-only preflight cannot mark T40 complete. Exit 1 means an explicit
baseline failed. The development fixture in `tests/agent-evaluation/development.ts`
is exposed training material for the harness, not a held-out evaluation case.

Live execution additionally requires `--config OWNER_CONFIG.json --live` and
`AELIQO_EVAL_OPENAI_API_KEY` in the process environment. The owner configuration
must explicitly authorize the exact corpus SHA-256, two distinct weak/strong
model IDs with exact expected reported snapshots, repeated trial count, token/request/time limits, a maximum USD spend
reservation, and positive reviewed input/output prices with their source. The
configuration has no credential field. No live run has been authorized or run.
The existing official OpenAI adapter uses provider-default sampling/reasoning
settings; this runner does not silently emulate an unsupported effort setting.

Before each trial, the runner reserves a conservative bound using all permitted
model requests, input tokens, turns, output tokens, and the supplied rates. It
records reservation and usage-derived estimates separately from charged cost,
which remains unknown. Price changes or extra provider fees are outside this
estimate; live approval must use current reviewed rates. It rejects missing or mismatched expected reported snapshots and captures
model snapshots and response IDs without storing raw provider reasoning or
headers. Source and corpus hashes accompany every report. A changed source
invalidates candidate qualification.

Data correctness compares named outputs, selected values/order, grain,
completeness, and scope against fixture answers excluded from model context.
Wilson intervals show sample size and uncertainty; unrun groups have null
intervals. UI completion and prose grounding remain null until those independent
checks are supplied. Provider failures stay in the model trial denominator.

The current scorer rejects extra selected fields, unexpected row keys, and duplicate
output identities. Corpus parsing requires unique output/field identities and
complete expected row values with bounded execution budgets. Each expected output now requires an independently authored quality oracle for
identity, population count, exact precision, source revisions and evidence kind/
definitions. The scorer also checks loaded counts and internal population-digest
agreement. Digest presence/agreement does not prove population membership or
business meaning; independent cohort/arithmetic/domain oracles remain required. The owner
configuration is a reviewed CLI input, not an authentication credential or proof
of consent. Live execution still requires explicit owner authorization in the
controlling session before any provider call.

## Actual MCP explicit baseline

Run `pnpm build:agent` first, then add `--mcp-explicit` to the preflight command to run each explicit task through
an official MCP SDK client and a separate stdio child using the production
Aeliqo MCP adapter. The child receives only the application fixture fields;
expected answers and user prompts are not part of that file. Each child host
exposes the same scoped data-only capabilities, and its resources are disposed
after the call. The client validates receipts and Result descriptors before the
independent scorer compares returned values and quality.

Reports separate `explicit-task` from `explicit-mcp`, preserve the configured
protocol pin, discovered tool-schema hash, server metadata when available, raw
call/connection timing, transport detachment and separately observed child exit.
The child closes its Vite loader and MCP server on stdin closure or termination;
the parent checks process liveness for at most five seconds after SDK teardown.
Missing exit evidence or private-fixture cleanup failure fails the baseline.
A failed explicit MCP baseline
returns exit1; successful baselines still return exit2 with T40 blocked. These
are actual local protocol trials, with no model adapter configured. They do not
measure an external agent's reasoning, hosted HTTP operation, UI completion or
prose entailment, and they do not enter weak/strong model-score denominators.

## Development UI boundary

`pnpm test:agent-evaluation:ui` exercises a separate, exposed development
fixture through the built evaluator, capability dispatcher, agent composition
validator, region transaction and actual web table. Evaluate, propose and commit
use separate grants. Browser assertions inspect the surface before commit,
real checkbox selection, malformed and stale proposals, and revoked late work.
Host tests also cover fresh commit after repeated evaluation.

The fixture has no provider connection or held-out answers. It does not add
results to the live runner, model denominators, or held-out UI/prose scores.
Its purpose is to validate the observable UI path before a separately authorized
evaluation uses it. Draft/IME behavior, varied compositions, task usefulness
and prose entailment remain outside this small fixture.
