# 16 — Test strategy and evaluation oracles

## Pyramid by failure type

Schema fixtures prove accepted/rejected structure. Semantic tests prove units/grain/relations/query scope. Property/model tests prove command-sequence invariants. Component tests prove local states. Browser tests prove integration/focus/rendered outcome. Real-harness evals prove observed routing behavior. External-user studies prove usability/adoption. None substitutes for the next layer.

Use the existing project test stack where healthy. Candidate tools from the blueprint: Vitest, fast-check, Playwright and axe-core; fast-check supports command-based model testing for stateful behavior. [R16, R17]

## Core properties

Replaying an idempotent request produces no duplicate mutation. Stale batches never overwrite newer state. Rejected/preparation-failed operations do not partly mutate the workspace. Referenced nodes/fields/ports exist. Allowed links converge without unbounded cycles. Undo of presentation operations restores the prior relevant state unless explicit conflicts prevent it. Serialized specs round-trip without hidden executable values. Unknown schema versions/props/extensions fail with typed diagnostics.

## Data properties

Permutation does not change order-independent aggregates. Filtering then aggregating matches the defined reference scope. Ratio aggregation uses numerator/denominator, not unweighted subgroup percent mean. Unit/currency incompatibilities reject or facet. Downsampled presentation never changes exact analytical results. A loaded page never pretends to represent a global dataset. Explicit relation cardinality prevents duplicate-measure fanout.

## Browser scenarios

PoC characterization before refactor. Manual versus tool command parity. User edits while agent applies; reparent/resize and input preservation; partial result; cancelled query; reconnect; hidden tab; multi-tab target ambiguity; permission change; SSR/hydration; lazy component failure; theme/locale/RTL; keyboard chart interaction; memory cleanup. Assert visible data/meaning and accessible structure, not just a changed revision.

## Routing eval design

`evals/routing-cases.jsonl` is the seed specification set, not recorded successes. Translate/paraphrase independently in Indonesian and English. Hold out a separately authored set not embedded in tool descriptions or development prompts. Record harness/client/model/version/settings/date, initial context, allowed tools, selected workspace, sequence, outcome and failure reason. Multiple trials are needed for stochastic agents.

Positive: UI outcome is correct and completed or honest pending/partial. Negative: chat-only request does not mutate UI; no target does not affect a random workspace; business action requires proper permission. A schema-valid chart with an invalid money aggregation fails. A table dumped into chat when chart-in-workspace was requested fails.

Suggested internal release target: all deterministic critical cases pass; 100% of observed trials avoid unauthorized/cross-target mutations; at least 95% successful UI outcomes on eligible non-ambiguous tasks in the tested release configuration. This is a target, not a statistical guarantee; report sample size and uncertainty and never infer coverage from tool calls alone. A single serious safety/correctness failure blocks release regardless of average.

## Evidence hygiene

Every check records command, exit code, scope, commit and artifacts. `not run`, `blocked`, `failed` and `passed` are separate states. Don't convert missing infrastructure into a pass. Snapshot baselines must be reviewed; updating them is not proof a regression is acceptable.

The reference fixtures describe structural expectations, but the reconciled repository does not include the original kit's Python validator. They do **not** count as executed schema, production semantic, browser UX or external agent-routing evidence. Local implementation must port and execute admitted specifications against the actual runtime.
