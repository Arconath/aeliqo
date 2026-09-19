# Final-v3 audit and correction record

Date: 2026-09-19. Inputs: all eight v2 Markdown documents plus its archive manifest, current `main` branch metadata, selected repository source and official references in `04-RESEARCH.md`. Output: a consolidated replacement plan, not product implementation. A passing hash check on v2 established integrity only; it did not establish semantic correctness.

## Findings and resolution

| ID | Finding in earlier pack/chat | Resolution in final-v3 | Implementation proof owner |
|---|---|---|---|
| A01 | Examples alternated between feature props and live-controller props; data was sometimes captured inside reusable feature definitions. | Canonical renderer consumes a scoped controller; immutable feature and session bindings stay separate. Local and advanced paths converge. | T01–T03, T10 |
| A02 | An AgentBridge above the child scope had no explicit active scope/target and risked global discovery. | connectAgent requires a ScopeController and target allowlist; a host React wrapper is under that scope, no default React-to-agent dependency. | T14 |
| A03 | Scope switch reset domain drafts while general UX promised preservation; no voluntary vs security-forced distinction. | Keep the old authorized subtree mounted during Save/Discard/Stay; recheck changed draft/selection before voluntary acceptance; forced invalidation fences access and masks old content, with old-scope-only optional recovery. | T04, T13 |
| A04 | v2 scope example expected the same controller to mutate to the new tenant, making captured callbacks ambiguous; ID equality missed A-B-A. | Immutable address, activationEpoch and surfaceGeneration; hooks bind new controllers, old references cannot retarget. | T03–T04 |
| A05 | 'Trusted application scope' could be read as trusting a browser ID. | Selector is not authorization. Server membership/permissions verified per relevant operation; nested scopes narrow parent lineage. | T04, T16 |
| A06 | Workspace-level adaptation had been interpreted only as tenant switching. | Separate bounded workspace layout composition within one scope; no new universal workspace component or distributed transaction claim. | T09 |
| A07 | Cache/cursor partitioning tied every source or scope revision too broadly to retention; risk of unnecessary misses or invalidation on every update. | Stable semantic cache keys plus separate activation fence, explicit live versus snapshot cursor contracts and reauthorized reuse. | T06 |
| A08 | Scope test referenced getSnapshot().scope/selection absent from the written generic interface; createScopedOrdersFixture was not defined in fixture inventory. | Address is explicit, selection is typed state, real scope fixture and delayed read handshake are defined in their task. | T01, T04 |
| A09 | Scope race deferred a fake read without proving a real read started; local update asserted a variable equaled itself; raw HTML substring could pass inside a script. | Non-vacuous race, observed ResultStore data updates and JS-disabled DOM SSR assertions. | T04–T05, T12 |
| A10 | Keeping the network bridge alive did not explicitly reset provider transcript/previous-response/reasoning continuity. | Pair new scope session, clear prior context and verify the next outbound model payload; external retention limits disclosed. | T14–T15 |
| A11 | v2 readme/prompt still named v1 archive and prefix despite v2 ZIP content. | One final-v3 archive name, version metadata, manifest-root discovery, task index and safe preservation of existing checkpoints. | Handoff validation, T20 |
| A12 | Guard, React adapter, actions and agent handling were bundled into an oversized runtime task with inconsistent dependencies. | Dedicated scope task and workspace-composition task; 22-task acyclic graph and 46 mapped requirements. | All task owners |
| A13 | Large-scale/best-API language could be interpreted as verified capacity and universal compatibility. | Final recommendation with named workload/framework/provider qualification; no universal optimum or unbounded capacity claim. | T18–T21 |
| A14 | Cross-boundary web conditions were too general: cached SSR, script escaping, CSRF, origin checks, bfcache/session refresh. | Explicit tests and host responsibility map; never use a client render receipt to authorize server mutations. | T12, T16 |
| A15 | External-store-driven lazy presentation could suspend existing content, undermining continuity. | Preload/stage candidates and retain authorized prior view; lifecycle replay and selector isolation tests follow React's documented constraints. | T10, T13 |

These are findings about a **design/plan and earlier examples**, not claims of confirmed exploitable vulnerabilities in the current released Aeliqo implementation.

## What was verified during this revision

The accompanying `VALIDATION-REPORT.md` records actual pack checks and the isolated declaration-only TypeScript probe. Every product requirement remains NOT EXECUTED in the fresh checkpoint. Source `main` was re-read and still resolved to `9092d6cff454b81cd623a7a4be7621c6a750d9c7`; no repository branch, source, CI, package registry, GitOps, or production system was changed.

All v2 requirements were retained, corrected where necessary, and remapped. New requirements cover guarded/forced transitions, immutable targeting, workspace composition, browser boundary security, cache identity, scoped model continuity, API consistency and handoff consistency. The task graph places scope before the data/React/agent integrations it governs.

## Evidence boundaries

- Pack integrity and schema/type coherence: checked locally and reported separately.
- vNext product compile/build/browser/security/performance: not executed by this planning session.
- Live model quality, real user DX, real low-end device behavior and production scale: not established.
- Package publication, production deployment and runtime smoke: not performed.

The deliverable is the final recommendation and executable task brief for Codex. Optimization is against explicit design priorities and measurable acceptance criteria, not a proof that one API is universally best. Do not add more abstractions merely to increase the requirement count or claim completeness.
