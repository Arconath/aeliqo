# 30 — Smartness as an operational contract

Status: Master consolidation design. No product/AI benchmark pass is asserted by this chapter.

## Goal

An end user describes a need without writing SQL, formulas or UI code. Aeliqo combines an authorized catalog, available capabilities, user meaning, tested components and an agent where useful. It must solve new combinations, not match a list of canned prompts. Intelligence is judged by accurate useful task completion, not by how much the screen changes.

## Three loops, one authority boundary

1. **Reasoning loop:** discover -> propose -> bind -> evaluate -> inspect -> refine/stop -> propose presentation. The model may choose a question, derive a hypothesis, propose a typed expression/query or registered view graph, and explain evidence. External agent hosts and an optional BYOK loop enter the same proposal boundary. No mandatory nested model invocation.
2. **Compilation loop:** bind names/versions -> check semantics/policy -> plan/negotiate -> execute -> validate results -> compose feasible experience -> stage -> recheck -> commit. Pure passes are repeatable given explicit versions/clock facts; effects remain runtime/host-owned.
3. **Interaction loop:** typed control event -> local parameter/state delta -> affected result/view update. Hover, typing, selection, layout resizing and ordinary pagination do not require model calls. A natural-language request can enter reasoning without changing this path.

## Agent capabilities and effects

| Operation family | May return | Side-effect boundary |
|---|---|---|
| Catalog read | paged authorized descriptions, related capability IDs | read; no schema-wide dump by default |
| Task propose/bind | accepted draft or structured semantic/capability gap | no query/UI mutation |
| Task evaluate | scoped result handles, summaries, resource costs | read execution; no UI commit |
| Result inspect | authorized bounded values/summary/contributors | read and explicit model-egress policy |
| Meaning propose/preview | typed definition draft, assumptions, preview | no organization activation |
| Meaning activate | versioned active definition | permission/scope/approval check |
| Experience propose | candidate graph and coverage explanation | no immediate UI change |
| Experience commit | exact revision-bound receipt | guarded presentation mutation |
| Action propose/execute | approved domain result/ambiguous failure | separate business authorization/confirmation |

These are effects, not nine permanently eager tool schemas. Project concrete typed tools lazily; never hide a destructive operation in an opaque generic `do` tool. Registered view IDs or expression operators in a proposal are data, not executable code.

## Trusted boundary

The runtime receives the actor/principal/approval from its configured host, not from the caller's JSON. An agent cannot mark a proposal as human. Validate request shape, input budgets, semantic scope, dependencies, renderer/pattern permissions and required operations. Capture a read set. At commit recheck catalog/profile/policy/task/region/result versions. A conflicting user choice made after proposal invalidates it. Do not repeatedly overwrite the user while trying to auto-repair a stale plan.

## Context and continuity

Conversational references resolve to typed context entries: entity keys, cohort definition, result revision, active filter, selected period, comparison baseline and region target. “Those five” is either a fixed cohort or explicitly live query membership. Store interpretation and lineage; do not use whichever rows happen to be visible. On result expiry, revalidate/requery or explain what changed. Do not serialize a full transcript into the core.

Default scope can resolve low-risk ambiguity only when the application defines it and the UI discloses it. Material ambiguity that changes the result produces one concise choice, not a silent formula. A user who cannot author meaning sees a request-for-definition path, not an editor with ineffective permissions.

## Derived meaning workflow

Already-known operation -> execute according to declared semantics. Temporary derivation -> scope to the task/session and label assumptions. Reusable business definition -> AI-assisted or manual authoring, type/grain/dependency tests, preview, activation policy. Do not make every arithmetic expression a permanent organization metric. AI assistance writes structured definitions and tests; it is not the evaluator. Opaque host metrics are supported by their output contract, not emulated client-side.

## Investigation discipline

The model can investigate a broad question using multiple bounded reads. Each step states an observable subquestion, selected outputs, allowed query cost, and expected stopping information. Results may justify a next query; they do not justify causal claims automatically. Stop at answered question, resource budget, denied capability, insufficient evidence, user interruption, or no informative next step. Progress is visible; only a coherent useful result is presented unless the user explicitly requested stepwise screens.

Do not let an agent's curiosity trigger unlimited scans, unpublished computations on sensitive data, or a growing wall of charts. The user can cancel, inspect scope, choose a representation, and return to the last valid experience.

## Claim grounding

Explanations attach observable claims to output/result/definition/period/scope identities. Exact numbers are drawn from approved result fields or deterministic computations; the model cannot invent a value because it fits the narrative. Distinguish descriptive observation, computed comparison, model inference, and causal hypothesis. A display of a source link alone does not prove that the source supports the claim.

An example acceptance fixture has both group rates improve while the pooled rate falls because population weights change. “Every group got worse” must be rejected by factual checking/evaluation. Multiple exploratory tests create additional uncertainty; inferred anomalies disclose the method/scope and do not become domain labels such as fraud or misconduct.

## Degrees of autonomy

Autonomy is configured independently for read exploration, session derivation, presentation mutation, organization meaning activation, and business writes. Defaults can allow useful read/UI assistance in a composable region while requiring explicit approval for shared definitions or consequential actions. Do not make a single `agentic=true` permission encompass everything.

## Smartness completion

A new catalog plus definitions should support previously unseen requests without modifying generic planner code. A valid new composition should not require a new preset. Changing a dataset name cannot break a schema-based task. Missing capability must lead to a correct gap or legitimate lower-scope alternative—not fabricated success. Test against [the evaluation plan](32-evaluation-plan.md), not subjective enthusiasm.

## Master edition 1 — canonical references

Reasoning and proposal quality may vary by model; operation authority does not. Chapter37 defines independent grants and recovery. Do not convert an exact catalog match into certainty about latent user meaning, or a numerical source citation into verified prose entailment.

[Master](../MASTER-SOT.md) · [AI contract](37-model-failure-containment.md) · [Release](18-release-migration.md).

## Developer-provided meaning is a normal starting point

Read existing active, authorized application meanings before asking a user to define a missing term. Those meanings may be supplied by developer code/config or a host-backed metric. End users are not asked to rewrite them. Resolve ambiguity and explicit scope/version normally; do not elevate a default's authority based only on its origin. New AI drafts cannot replace repo-owned meaning silently. Code-only authoring/registration must work without the reasoning loop.
