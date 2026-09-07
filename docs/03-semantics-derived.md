# 03 — Meaning, derived values and authoring

## Separate shape, meaning and evidence

Shape describes stored values. Meaning describes identity, grain, units, relations and domain concepts. Evidence describes where a declaration came from, who can approve it, and whether its mathematical/operational assumptions hold.

A field can be `decimal` without being summable. A table can contain employee records at employee-day grain; `count(rows)` is then not employee count. An absent observation is not an absence event. A `salary` field does not reveal whether the value is hourly/monthly or gross/net.

Each declaration contains stable namespaced ID, semantic version, description, input dependencies, output type/unit/grain, allowed aggregation dimensions, null/zero policy, source provenance and authorization classification. IDs do not contain model/provider names or UI component names.

## Automatic derivation and two authoring modes

**Automatic:** only provable transformations from confirmed descriptors, such as counting a declared unique entity identity, formatting a confirmed currency, or grouping a date using an approved temporal policy. They create explicit inspectable definitions, not invisible formulas.

**Define with AI:** an authorized user describes a concept in natural language. The model receives only authorized catalog metadata and a constrained expression vocabulary. It proposes a definition with assumptions and test examples. Aeliqo typechecks dependencies, unit/grain, supported execution and cost, then previews results. The result is still a *draft business definition* unless the configured scope policy permits activation.

**Define manually:** developer-authored typed code/config and the Studio visual editor are first-class manual authoring surfaces. Developers can ship reusable meanings as application defaults; end users do not have to recreate them. Both surfaces create the same canonical typed definition. Manual input does not bypass typechecking, authorization, versioning or preview. A formula string is not evaluated as JavaScript or SQL.

Origin and trust are orthogonal: `origin = system | ai-assisted | manual`; `lifecycle = draft | active | deprecated`; `scope = session | personal | workspace | organization`; `approvedBy` is optional only where policy allows. An AI-origin active definition stays labeled AI-origin.

## Configurable activation, not a universal approval wall

Ordinary low-risk read analysis may allow an explicitly labeled session-only hypothesis after validation, with a visible assumption banner and easy edit. It cannot overwrite an organization metric. A solo user's manual approval is sufficient for their private catalog when policy allows. Shared organization metrics require a designated semantic steward or approval workflow. Consequential decisions/actions require domain-defined review regardless of origin.

The user-requested choices remain **AI-assisted or manual**. Approval is governance on publication/scope, not a third definition engine. Do not force everyone to write formulas, and do not activate every plausible model formula silently.

## Typed expression representation

Use a small typed DAG with literal, field/metric reference, comparison, Boolean predicate, arithmetic, case, coalesce, explicit cast, approved aggregation, distinct entity count, temporal bucket and window functions. Aggregation context is explicit: row, group, window, or aggregate-of-aggregates. Division requires denominator-zero behavior. Null comparisons use explicit `isNull` and three-valued predicate rules, not JavaScript truthiness.

Units include dimensions and qualifiers: money with currency, duration with unit, ratio/percentage, count with entity/grain. Decimal money is encoded as a decimal string plus scale or a safe fixed-point integer representation. JSON number is not silently used for exact large integers/money. Output type validity and precision are checked across executors.

Do not permit arbitrary recursive computation or Turing-complete expressions. Registry functions must have input/output types, determinism, null policy, cost bounds, aggregation properties, local/server realizations and test vectors. Browser execution is allowed only for trusted compiled functions within declared limits.

## Aggregation correctness

A ratio is re-aggregated from its numerator/denominator, not by averaging percentages. A semi-additive balance can sum across accounts at a time but not across time. Distinct counts do not add across overlapping groups. Join fan-out cannot duplicate a fact measure. A registered business calculation must specify its evaluation grain and legal rollups.

A requested combination with incompatible currency/grain/methodology is rejected or shown in separate labeled views; no automatic unit/currency conversion. Conversion requires an explicit dated conversion source and policy.

## Temporal meaning

Distinguish instant, local date and calendar period. Bind locale/timezone, week start, calendar and half-open `[start,end)` intervals explicitly. Resolve “last three months” and “last 90 days” differently. Record the clock reference in the task. Do not synthesize missing periods unless the source declares its grain and the absence semantics are known.

## Example: attendance

An approved application policy might define unexcused absence rate as unexcused required workdays divided by eligible scheduled workdays, excluding approved leave. The policy must say whether excused sickness or remote work counts, how schedule revisions apply, and how multiple check-ins collapse to one employee-day. Missing logs are unknown until the domain adjudicates them.

Aeliqo can compile and reuse that definition for rankings, department breakdowns, trends and comparisons. It does not decide which attendance policy is fair or use it to make employment decisions. The fixture in `fixtures/hr` is a synthetic example of one policy, not a recommended HR policy.

## Changes and traceability

Maintain a dependency DAG and reject cycles. On edit, publish a new immutable definition version; preview impacted tasks before activation. Existing saved tasks pin a version or explicitly opt into migration. Historical results retain their definition digest. Rollback restores the prior active version without deleting provenance. Identical AI/manual definitions normalize to the same canonical expression, enabling parity tests.

## Acceptance

Tests must cover wrong grain, fan-out, mixed currency, ratio-of-sums, zero denominator, missing logs, stale domain revisions, dependency cycles, policy scope, AI injection in field descriptions, rejected arbitrary code, definition evolution and local/server expression parity. “The schema parsed” is only the first of these tests.

## Master consolidation ad-hoc analysis, registry identity and inference

Do not publish a reusable metric for every subtraction/filter/grouping requested by a user. Distinguish a bound operation over existing meaning, a session-scoped derivation, and an active reusable definition. AI-assisted and manual editors still emit the same bounded expression representation. Structural means justified by declared semantics, not guessed solely from a field name or numeric type.

Every function call references an immutable function ID/revision; a compiled plan also pins the function registry digest. Updating function code without changing its digest/version is forbidden. Canonicalization must not reorder floating-point reductions or user-visible order unless semantic equivalence is proven. Exact integer/decimal arithmetic and approximate IEEE arithmetic are distinct; executable parity tests use declared tolerances.

The single scope vocabulary is session, personal, workspace, organization. Origin is not authority. Manual formulas receive the same validation as AI drafts. Approval records an authorization decision, not statistical truth. A domain function may remain opaque on the server; its output contract is checked without pretending the client can execute its private implementation.

Model-derived classifications/summaries of free text are **inferred outputs**, not exact business facts. An explicit inference policy/model recipe, source/output provenance, uncertainty statement and retention/egress permission are required. Such work is effectful outside pure expression evaluation; it cannot masquerade as deterministic SQL aggregation. v0.1.0 may expose a host-owned inferred-output capability without building an inference-job platform.

## Developer-authored application defaults (edition 1.1)

The developer may declare identity, units, grain, relationships, aliases, derived metrics and predicate meanings where these are not safely available from source metadata. Reuse the existing Catalog references; never require the developer to retype the physical schema, every field or every possible question. A definition describes meaning, not a component, layout, query per phrase or model provider.

Code/config and Studio are manual surfaces. AI assistance can propose definitions for either developer or domain-author workflows; it is not restricted to end users. Keep `origin = system | ai-assisted | manual` separate from authoring surface/provenance and authorization. Do not add a special developer evaluator or a developer permission shortcut. All surfaces lower to the same typed definition, dependency checks and executor path. Preserve materially AI-assisted provenance through export/edit.

A reviewed application bundle can be registered and activated by a trusted deployment/startup pipeline under host policy. It needs no LLM, Studio session or repeated runtime approval per question. Invalid definitions fail registration with a precise field/expression diagnostic; activation never bypasses unit/grain/dependency/capability/authorization checks. Hot replacement is atomic for the affected bundle: retain the prior valid version on failure, except when permissions have been revoked. Client-supplied `approved`, `developer` or `active` flags grant no authority.

A code-owned definition has stable ID, immutable revision/digest and repository ownership. Studio shows its provenance and is read-only for that source, or exports a proposed diff/new revision for the repo review workflow. No bidirectional silent source overwrite. Identical canonical content for the same ID/revision is an idempotent registration; different content is a conflict. Explicit pinned references resolve first; aliases with material ambiguity produce a choice. Do not silently shadow a deployed meaning with a personal/AI definition. A scoped alternative uses a distinct identity and explicit task binding allowed by host policy.

An opaque application metric remains supported when its private calculation lives on the backend. Register its typed inputs/output, legal grain/rollups, scope, version and execution capability; do not make up a local formula. Raw JS callbacks in a browser definition are not a portable formula. Trusted function implementations use the existing registry/version/conformance boundary.

Acceptance: code-only bootstrap without model/network/Studio; schema reuse and useful type errors; code/Studio equivalent definitions produce equivalent results through the same evaluator; invalid unit/grain/unknown ref fails; read-only ownership/diff workflow; no silent identity collision/shadow; one metric reused for table/ranking/trend without embedding UI decisions. See scenarios S65–S67 and existing T04/T06/T23/T25. These are product tests to implement, not claims that the kit has an SDK.
