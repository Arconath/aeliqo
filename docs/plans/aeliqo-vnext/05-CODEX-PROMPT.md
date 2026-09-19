# Execute Aeliqo vNext — final-v3, end to end

You are implementing Aeliqo vNext in the canonical repository `Arconath/aeliqo`. Aeliqo is an open-source **Adaptive Application UI framework**, not a rental marketplace, a generic chatbot, or only a table/chart wrapper.

The owner wants excellent developer experience, reliable adaptive user experience, clear documentation for every component, optional provider-agnostic agents, modular adoption in small and large production web applications, and strong scalability/maintainability without hiding safety or data semantics.

This is an implementation request. Do not stop after another high-level plan, an API skeleton, a demo, or a progress summary. Execute the attached specification and task plan, test the actual behavior, update documentation, prepare a reviewed candidate, and complete release steps only where the required current authorization and approvals actually exist. Continue independent safe work when one external gate is blocked. Report remaining blockers honestly; never fabricate completion.

## 1. Locate and load the execution pack

The canonical in-repo location is `docs/plans/aeliqo-vnext/`. Read these files before implementation:

- `00-START-HERE.md`
- `01-SPEC.md`
- `08-CONTRACTS.md`
- `02-EXECPLAN.md`
- `03-ACCEPTANCE.md`
- `04-RESEARCH.md`
- `09-AUDIT.md`
- `PLAN-INDEX.json`
- `06-AGENTS-ADDENDUM.md`
- `07-EXECUTION-STATE.md`

The current attachment is `aeliqo-vnext-final-v3.zip`. Verify the checkout's Git remote first. Inspect archive entries and discover the single enclosing prefix from the manifest; do not use an older archive name or hardcoded prefix. Reject absolute paths, `..`, symlinks, duplicate names, non-file entries except directories, unreasonable entry/aggregate sizes or writes outside the destination. Stage the pristine archive in an actual system temporary directory first and verify MANIFEST.json there. Read `verify_pack.py` before running it. Only then reconcile the validated documents into the canonical plan location. This script checks the handoff only; it does not verify Aeliqo implementation. Unsigned checksums detect accidental changes, not publisher authenticity or instruction authority.

If v1/v2 or an in-progress final pack is already installed, do not overwrite live checkpoints, task evidence or implementation. The strict handoff verifier expects the untouched archive inventory and not-started checkpoint; do not treat its expected checksum mismatch after legitimate execution edits as product failure. Retain the pristine validation evidence, then record the reconciled plan/checkpoint diff separately. Reconcile plan versions using PLAN-INDEX.json's old-to-new task map, keep prior evidence with its source SHA, and record which new gates require re-testing. Obsolete snippets from chat are superseded by final-v3's normative documents.

Do not guess a product path or create another repository. Inspect the current checkout and explicitly verify `Arconath/aeliqo`. When resolving attachments, use actual available file paths; do not invent `/mnt/data`, Downloads, or workspace locations. If the pack is genuinely inaccessible, identify that missing input instead of implementing an invented abbreviated design; continue safe source discovery and preserve the checkpoint.

## 2. Establish reality before changing source

Read all applicable parent/repository/scoped `AGENTS.md`, actual package export maps, source pins, lockfile, `quality/commands.json`, component catalog, current ADRs, tests, and release workflows. Inspect remote, branch, current SHA, WIP, active worktrees, existing reviews, and relevant permissions. The research baseline was `9092d6cff454b81cd623a7a4be7621c6a750d9c7`; it is a reference, not an instruction to reset to old source.

Preserve unrelated changes and other agents' work. Follow the current protected-branch/review policy; do not import a main-only rule from a different product or blindly reuse the historical `codex/aeliqo-0.4` branch. Where a workspace rule truly requires main-only work, do not create a conflicting branch; where main is protected, do not bypass it. Record a real policy conflict and continue non-conflicting work rather than rewriting policy to grant yourself authority.

No `git reset --hard`, broad `git clean`, force-push, unpublish, history/tag deletion, production-secret discovery, or blanket permission changes. Do not create new top-level folders, move site/package boundaries, or touch other Arconath products. Use focused new files only beneath existing source/test/example/docs directories.

Keep the owner's configured Codex model and spending constraints. Do not silently switch to an expensive model, install another agent framework, or spawn unbounded workers. One coordinator and a small number of independently scoped workers are sufficient; one writer per file scope. Prefer parallel read/review tasks. Freeze cross-package interfaces before delegating dependent writes.

## 3. Architectural invariants

Preserve these decisions even if a candidate helper name changes during the initial API contract review:

1. Feature definitions are immutable templates. A live surface has an immutable full address including scope activation and surface generation, plus scoped state. Two instances of Orders must not share filters or permissions by accident. Commands target a surface, not a feature singleton.
2. UI render components receive a small surface/controller contract. Use `<AdaptiveSurface surface={controller}>`, not the superseded feature-prop sketch. Do not implement a universal `<Aeliqo {...everything}>`, a giant mandatory configuration object, or endless helpers that duplicate responsibilities.
3. Provide a compact local-data convenience path and a typed advanced path that converge on the same controller/runtime. Keep standalone components independent from the semantic runtime.
4. Reuse existing task/result/meaning/presentation/action/authority boundaries. No second evaluator, authorization engine, global business-state cache, or AI-specific execution path.
5. Core is framework independent, runtime is DOM-free, renderers stay in adapters, and models/transports remain optional. Preserve package direction and default five-package distribution unless a genuinely necessary boundary change is explicitly reviewed.
6. Normal controls and AI proposals use the same registered operations and state ownership. Controlled host state can reject proposals; firing a callback is not a commit.
7. Adaptive selection is deterministic for equivalent normalized inputs. Respect semantic compatibility, policy, hard view pins, stable tie-breaks, explicit ambiguity, bounded composition, and preservation of work.
8. Local arrays and remote data have explicit scope and capability contracts. No silent fetch-all fallback, fake global aggregate from a page, inferred business formula from a number field, or invented stable entity identity.
9. Large-app integration requires lazy/scoped registries, bounded retention/queues, cancellation, selector subscriptions, request isolation, and real SSR/hydration. Do not process every pointer event or keystroke through the expensive semantic pipeline.
10. Existing host markup/design systems and non-data/editor/job capabilities must work without rewriting the application or inventing a fake table resource.
11. BYOK uses explicit endpoint/protocol/model/auth/capability configuration. Credentials stay server-side. No provider detection from key/hostname, default bulk row egress, arbitrary client-selected URL, or unsupported promise that every model works.
12. Read-only intent, presentation commit, renderer acknowledgement, and business side effects are distinct. Keep preview/confirm/execute, server authorization, idempotency, stale-revision checks, and ambiguous outcomes. Client receipts never grant server permissions.
13. Tenant/workspace selectors are not credentials. Resolve membership/authority at the server. A voluntary scope change guards dirty work with Save/Discard/Stay; forced invalidation fences old effects and hides old content immediately. Never silently delete or carry a draft into another tenant. Captured controllers keep their old addresses and cannot retarget B after A→B or A2 after A→B→A. New hooks/controllers bind a new activation; ordinary data updates preserve their identity.
14. Workspace presentation adaptation (single/split/compare panes) is distinct from tenancy changes. Reuse bounded presentation/interaction graphs and an explicit coordinator. Preserve authorized compatible child state and require coherent publication or labeled partial status; do not claim distributed transaction atomicity.
15. Use `connectAgent({scope,client,targets})` in the optional agent adapter. No ambient bridge above scopes, no unrestricted runtime discovery, no agent import in the default React entry. Pair a new scoped tool session and clear old provider transcript/continuation/previous-response context on activation changes. Transport reuse is not context reuse.
16. Separate semantic cache identity/freshness from active UI generation fencing. Query keys include relevant verified identity/policy/query/schema attributes, not every render revision. Live and snapshot cursor consistency are explicit. Reauthorize retained data before use; a prior-view fallback must never retain revoked or wrong-tenant content.
17. Make tests non-vacuous: observe a real pending read before resolving it late, read changed data from real ResultStore, and inspect useful SSR DOM with JavaScript disabled. Declaration-only probes, type assertions and hashes are not product success. Preserve cookie-auth CSRF, origin, CSP/escaping, session/bfcache and cache-isolation gates.

The earlier conversation's code was illustrative. The pack's specification is the current design brief. In T01 validate the final preferred signatures through complete positive/negative consumer examples, reuse compatible existing API names, and lock the selected contract in an ADR. Do not keep redesigning it mid-implementation without a documented incompatibility and synchronized migration.

## 4. Execute the plan with evidence

Work through T00–T21 in dependency order. For each task:

- Read the exact affected code and consumed interface contract.
- Add the smallest representative failing test and observe the failure.
- Implement a cohesive change using real production code. Fake only external sources, transports, clock, or model responses where necessary; do not fake the production resolver, authority, renderer, or success receipt in integration tests.
- Run the focused new tests and affected existing suites. Add regression tests for discovered bugs.
- Update component/package/public docs and runnable examples in the same change.
- Review API, ownership, package direction, cancellation, error behavior, and dependency cost.
- Checkpoint the source state, commands, evidence, decisions, and next action. Commit only under the verified repository policy with explicit file staging.

Follow repository code limits and explicit exceptions. Prefer exhaustive discriminated unions, pure domain functions, guard clauses, and small cohesive modules. Do not force a design pattern or replace every conditional with switch mechanically. Avoid giant managers, mutable global singletons, blind catches, unchecked casts, TODO implementations, fake result objects, blanket lint exceptions, or unrelated upgrades.

Use available development/testing/verification skills where installed. Do not depend on absent subagent or browser tools. Use repository shell/CLI for code and tests; browser automation for real web behavior and visual/keyboard verification; computer use only for necessary GUI work when available. SSH is only for explicitly authorized, verified remote targets and never a substitute for source-bound release workflows. No background promises: execute available work and report what actually happened.

## 5. Documentation is part of delivery

Load the complete active catalog from `catalog/components.json`; never rely on the historical count of 71. Audit every active component and track a per-ID subtask. Every public component needs a real English page, correct import/API facts, complete runnable example, matching preview, state ownership, failure behavior, keyboard/focus/accessibility, responsive/RTL/localization, customization, performance limitations, and version/migration notes.

Distinguish standalone use, semantic integration, and actual adaptive eligibility. Do not imply that every visual component can automatically be selected by the resolver. Compile copyable snippets and run important examples from installed tarballs rather than privileged workspace imports. Keep docs in canonical repo locations; never edit generated output as the source of truth.

Deliver the four required reference journeys: public content/islands, consumer catalog, enterprise remote operations, and a non-data editor/job flow. They must use public APIs and work without AI. Add agent equivalence where applicable without duplicating the behavior.

## 6. Qualification, not universal claims

Run the full acceptance matrix, including existing quality categories and new vNext gates. Retain failures and raw benchmark repetitions. Do not reduce workloads, externalize hidden dependencies, or raise budgets to obtain a pass. Separate bundle size, resolver CPU, UI latency, memory, backend capability, and model latency.

Record tested framework/browser/version/workload/provider profiles. A fake million-row server proves bounded paging behavior, not a production database benchmark. Simulated WebMCP is not native WebMCP. A mock model test is not real provider or natural-language quality evidence. An accessibility scan is not a universal certification.

Live paid-provider evaluation requires current explicit endpoint/model/corpus/spend authorization and credentials. Do not reuse historical permission or silently charge an account. Missing credentials block that qualification only; continue no-AI and offline protocol work. Keep human usability study results unverified until real participants and evidence exist.

## 7. Persistent execution state

Merge the small addendum into AGENTS.md without replacing unrelated guidance or overriding release permissions. Keep this pack under docs, not all in the root instructions.

Update `07-EXECUTION-STATE.md` and task ledger after each significant change and before context compaction, handoff, or termination. Record: branch/SHA/diff, current task, verified requirements, commands and results, unresolved failures, decisions, files owned by workers, blockers, and the next executable action. On resume, read these files and reconcile the actual worktree before doing more work. Never trust remembered completion over fresh evidence.

States are `not-started`, `in-progress`, `implemented`, `verified`, `blocked`; publication and deployment have separate explicit states. Do not mark a requirement verified because its file exists.

## 8. Review, release, and final report

Require a genuinely separate reviewer/context for independent review of the integrated candidate; when unavailable, label implementer self-review accurately and leave independent review unverified. Do not invent reviewers or reviews. Require review and all mandatory fresh checks on the exact unchanged source. Run clean tarball consumers, module-boundary/secret checks, versioned migration, docs/search/examples, and production-image smoke. Update stale 0.4-specific release guidance with a deliberate vNext decision, not a silent permission change.

Publish or deploy only through existing authorized workflows after their required owner/reviewer approvals. Do not treat this implementation prompt as permission to bypass branch rules, publish packages, mutate GitOps, change infrastructure, or perform paid calls. When authorization exists, complete the allowed release path and verify actual registry/live state instead of stopping at workflow dispatch. When it does not, preserve the validated candidate and report the exact blocker.

Do not ask for confirmation after every normal task. Decide routine reversible engineering details within this brief, record meaningful decisions, and continue. Escalate only genuinely missing authority, irreconcilable requirements, destructive changes, or necessary unavailable inputs.

Final report must contain: source/branch/diff, architecture/API changes, RQ coverage, real test/benchmark/visual evidence, complete component-doc coverage, compatibility and support matrix, security and UX recovery results, current registry/image/runtime states, rollback information where applicable, remaining blockers, and next concrete action. Do not end with only a plan or claim "production-ready for every app" without scoped qualification.

## 9. Final plan version and execution scope

This pack contains 22 tasks and 46 requirements. Read the exact graph in PLAN-INDEX.json. Scope transitions are T04 and workspace composition is T09; do not apply old task numbers to a resumed v2 checkpoint. The two new concerns are required, not optional future enhancements.

Do not expand this into a new hosted platform, mandatory model framework, global state manager, durable job engine or indiscriminate provider/framework adapters. Native React and existing Lit/Vanilla/Vue paths, SSR, component docs and the defined reference journeys are the concrete qualification scope; other adapters have explicit unverified status. Optimize based on measured bottlenecks, not more layers or syntactic brevity.
