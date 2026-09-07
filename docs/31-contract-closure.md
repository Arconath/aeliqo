# 31 — Contract closure before implementation freeze

## Public surface and internal proofs

Catalog/Task/Result/Experience are the four document families. Runtime ports and internal logical/presentation plans are implementation boundaries, not additional concepts forced on a simple consumer. `contracts/reference.ts` is a typed executable design reference. The accompanying guards/tests cover specified boundary invariants; they are deliberately not the production schema package. M1 must select one canonical schema source, generate public declarations/JSON Schema, and verify roundtrip/negative tests. Do not independently hand-maintain three schema languages.

## Required distinctions

| Concern | Representation rule | Why |
|---|---|---|
| Measurement | tagged known/unknown, not a made-up number | SSR/environment truth |
| Scope | session/personal/workspace/organization | one authoring vocabulary |
| Function identity | ID + immutable revision | reproducible meaning/queries |
| Task | data with named outputs, presentation with result refs, or form with schema/action ref | no fake query |
| Output dependency | DAG of named output refs | multigrain composition |
| Cohort | fixed result membership or explicitly live upstream output | stable continuity |
| Counts | unknown/exact(value, scope)/estimated(value, method, uncertainty) | no exact total without value |
| Precision | exact or approximate with method/uncertainty | no silent approximate results |
| Coverage | complete/partial/sample/unknown for declared population | transport completion != complete population |
| Evidence class | observed/computed/inferred with provenance | inference != measurement |
| Consistency | shared snapshot/mixed/unknown | no fake cross-source transaction |
| Interaction | discriminated built-ins + registered typed extensions | no arbitrary JSON masquerading as selection |
| Graphs | containment tree + output DAG + typed interaction links | correct lifecycle and propagation |
| Commit | preconditions/read set rechecked against current authority | stale AI cannot win |
| Search result | valid/conflict/unsupported/search-exhausted | incomplete search != impossibility |

## Multioutput query contract

Output IDs are unique within a Task. Dependencies must exist and be acyclic; reuse refs may reference prior immutable results under the same authorized scope. An output's input binding can consume a cohort from an upstream output with an explicit membership policy. Different outputs retain independent grain, schema, precision and consistency. A delayed detail query references the current stable selection at execution, not an old index.

Do not recursively embed arbitrary Task objects to simulate workflows. A bounded named-output DAG suffices for this scope. Cross-task references use IDs/revisions/leases; the runtime owns lifecycle. Query execution optimization may fuse requests if semantics and individual lineage remain equivalent.

## Role and primitive manifest

A role says what information or operation a view provides. Its manifest has input/output port types, compatible result grain/unit/schema, layout envelope, allowed state transfer, resource class and tested behavior. A pattern expands these roles into the same grammar. A primitive realizes a role on the platform. None owns business formulas or source authorization.

The registry may grow without an enum edit for each domain. Versioned extension schemas validate custom configs; unknown config fields fail closed. A client-provided schema cannot grant itself authority to execute a plugin. Maintain build-time trust and registry digests separately from model proposals.

## Three graphs

Containment must have one root, unique node IDs, one parent per visible node, meaningful reading order, no orphan, no cycle. Data dependencies are acyclic and grain-aware. Interaction links are explicit typed source/target ports; only declared equivalence propagation may cycle. Causation guards alone do not make arbitrary feedback semantics correct.

A coverage witness maps each required information/operation to actual registered view capabilities and any joint simultaneous group. Do not accept a plan merely because it self-reports `covered:true`. Validator checks references/capabilities/profile/environment. Empirical UI testing remains necessary: a structural witness is not a mathematical proof of usability or accessibility.

## Compatibility and migration

Package version is not contract document version. Pin contract schema version, semantic/profile revisions and function/renderer registry digests where used. Unknown major/minor capability combinations negotiate or reject with typed diagnostics; do not accept unknown operators by casting. Migration is explicit and tested using saved documents. Preserve prior readonly provenance rather than rewriting historical metric definitions.

## Auth and disclosure

Authorized scope keys and handle IDs are not bearer credentials embedded in UI state. Server authenticates principal and maps effective scope. Read dependencies on forbidden fields can be satisfied only by an explicit approved host aggregate capability; arbitrary client derivations cannot bypass that boundary. Model egress is an additional policy on descriptions/values/samples.

## Negative tests

The shipped probes reject malformed known sizes, absent estimate method, malformed event payloads, duplicate/cyclic outputs, self-reported unsupported coverage, stale preconditions. Separate numerical counterexamples expose join fanout; the prototype guards do not implement full grain-aware query validation. They show how counterexamples are represented. M1/production must port the vectors to the canonical validator and public SDK rather than import the probe as a substitute runtime.

## Master edition 1 — canonical references

contracts/agent-boundary.ts sketches BindingOutcome and independent OperationGrant. Chapter37 provides behavioral semantics. The production schema generator and negative suite must cover those states; reference types/guards are not imported as the completed SDK.

[Master](../MASTER-SOT.md) · [AI contract](37-model-failure-containment.md) · [Release](18-release-migration.md).
