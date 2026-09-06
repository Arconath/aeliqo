# Aeliqo local completion audit — 6 September 2026

## Scope

This audit covers the active local Aeliqo framework in `products/aeliqo`, the parent workspace identity records, the archived legacy Systems Doctor repository, and the Arconath portfolio-site source. The requirements are the repository `AGENTS.md`, `docs/POC.md`, `docs/ARCHITECTURE.md`, `docs/QUALITY.md`, `docs/DECISIONS.md`, the current Aeliqo documentation kit, and the user's instruction to finish the authorized local work rather than stop at an intermediate milestone.

Source, executable tests, generated package consumers, browser observations, archive fingerprints, hosted CI, immutable release artifacts, GitOps state, cluster observations, and public route checks outrank prose claims. The archived repository is inspected only for identity and preservation. Public package publishing, paid-provider credentials, a native WebMCP host, external users, and commercial customers remain outside the available evidence.

## Findings

### F1 — Product identity and archive preservation — satisfied

The former framework source is now `products/aeliqo`; maintained package names, symbols, CSS namespace, documentation paths, examples, pairing names, and workspace records use Aeliqo. The former Aeliqo Systems Doctor repository is preserved at `archives/products/aeliqo-systems-doctor-2026-09-06` with its nested Git history. A pre/post inventory covering 54,647 files and symbolic links produced the same SHA-256 fingerprint, `ff09cedbda72920a5814650e9cd02cce3b1648187e45815ee3b9dd34a226676c`; HEAD remains `e671f752b2b0e04cffc0782c37dcbe896be0bf25` with 48 reachable commits and a clean worktree. `products/aeliqo-agent` remains separate and unchanged.

Verification: search maintained source outside dependencies, builds, artifacts, and the intentional legacy archive for the former identity; validate `workspace.json`; inspect both nested repositories.

### F2 — The earlier component presentation understated the implementation — remediated

The active runtime contains sixteen catalog components plus Workspace: thirteen Level-1 semantic surfaces, three Level-2 compounds, and one Level-3 workspace. Metric, Table, Filter, Ranking, Trend, Detail, Comparison, Delta, RecordList, SelectionSummary, and Overview have direct typed props, isolated package subpaths, real tarball-consumer SSR checks, and compiled documentation examples. Scatter, Distribution, Relationship, Matrix, and Explorer retain semantic `store`/`node` authoring and are not presented as independently certified standalone packages.

The 118-entry component-needs file is a product coverage map. It is not an implementation inventory. Creating wrappers solely to raise the number would weaken the framework's contract and proof discipline. Per-surface evidence and limits live in `component-specs/completion-matrix.md`.

### F3 — Component behavior had concrete quality gaps — remediated in the promoted foundation

Ranking now treats negative values around a real zero origin and orders nulls last. Trend preserves missing periods and endpoints, handles zero and multiple series, and uses deterministic temporal parsing. Filter removes one constraint without clearing unrelated filters. Explorer reuses Filter and shares selection/filter state. Comparison now compares 2–8 controlled identities across 1–20 distinct declared metrics, preserves units independently, and shows missing or unavailable values honestly. The React SSR/hydration path no longer produces a Trend `<title>` mismatch.

These changes improve the promoted foundational workflow. They do not certify every catalog proposal or every retained semantic-only component state.

### F4 — CSS could affect its host application — remediated

Theme tokens are scoped to `.aeliqo-theme` or `[data-aeliqo-theme]`; the stylesheet no longer writes theme variables or interaction rules through `:root` and generic host selectors. Component variables have local fallbacks. Tests cover two independent themes, visible focus, reduced motion, forced colors, RTL, and 200% zoom at a 390-pixel viewport. The browser screenshots were visually inspected as local evidence.

### F5 — Core semantics and state contracts satisfy the bounded POC — satisfied locally

The headless core has explicit sum, mean, none, and ratio-of-sums semantics; finite/null handling; unit, currency, grain, relation cardinality, duplicate-identity, partial-data, stale-data, and temporal validation. Workspace state is normalized and revisioned, uses targeted subscriptions and atomic operations, distinguishes filters from selections, supports pins and bounded human undo/redo, and serializes presentation without application records or credentials. A trusted registry supports a third-party semantic component through bounded JSON configuration without modifying the central component union.

The core intentionally does not perform currency conversion, exact-money accounting, arbitrary joins, timezone calendar inference, remote data authorization, persistence I/O, or business mutations. Those limits are part of the contract rather than missing implementations.

### F6 — Agent control paths share one capability implementation — satisfied locally, externally limited

MCP, BYOK, and experimental WebMCP project `workspace_inspect`, `catalog_search`, `data_query`, and `workspace_apply` through the same dispatcher and operation model. Pairing binds one explicit workspace/renderer; exact-revision presentation receipts prevent a committed but disconnected or invalid view from being reported as presented. Tests cover protocol parity, chat-only non-mutation, request replay/collision, stale revisions, renderer failure, cancellation, and disposal. An official MCP SDK client and the companion browser path have local integration evidence; deterministic BYOK is fixture evidence. A fresh paid-provider call and native WebMCP-host run are unknown because those external facilities were not available in this audit.

### F7 — The documentation grammar is broader than the executable POC grammar — bounded, not falsely closed

`04-contracts-and-grammar.md` explicitly labels its EBNF as a composition sketch and `docs/aeliqo/contracts/v0.1` as a narrower candidate authoring subset. The reconciled repository does not include the candidate kit's former Python validator, so those JSON fixtures are specifications, not passing evidence. The running v0.2 capability/operation schemas in core are the authority for executable agent input and are validated at runtime. Full recursive layout trees, the complete predicate grammar, registered transforms, migrations across published major versions, and every candidate schema are not shipped runtime features. They remain unmet product-expansion work until a real use case passes the admission rules; none is required to prove the current four capabilities.

### F8 — Smartness exists at all required levels and categories — satisfied for the bounded proof

- Data: one dataset descriptor drives metrics, formatting, aggregation, filters, time, relations, partial scope, and provenance.
- Component: deterministic components adapt density, labels, missing states, geometry, and rendering without model calls.
- Interaction: typed selection and filter ports connect compatible components; relationships resolve cross-dataset selection explicitly.
- Workspace: validated operations incrementally mount, configure, move, connect, select, pin, undo, persist, and inspect trusted components.
- Levels: Level 1 primitives feed Level 2 Comparison and Explorer; Level 3 Workspace composes the registered renderers and keeps application data outside workspace state.

This establishes the architecture with local fixtures and browser scenarios. It is not evidence that every conceivable component or business domain is smart.

### F9 — Production playground delivery — satisfied

Hosted validation run `34041226796` passed for exact source revision `da9142ade2db617f283ef6e9eb6fff4539f26ef3`. Owner-dispatched trusted release run `34041428044` published immutable image digest `sha256:88bcc3f05749cb57cbcac531a8f84e726ca615754a7bd4d8e294164bd0e9fd38`; its CycloneDX 1.7 SBOM reported two components and zero HIGH/CRITICAL vulnerabilities. Flux restored that digest after successful configuration and binary rollback drills. Two non-root, read-only replicas are ready with zero restarts, and the apex and www routes pass home, health, readiness, exact revision, SPA fallback, missing-asset, and security-header checks. The server's SIGTERM test proves an active request completes after readiness changes to 503; production uses a five-second routing drain, twenty-second shutdown timeout, and thirty-second pod termination grace period.

An OSS license, public repository, npm publication, external onboarding, independent usability study, paid pilot, and commercial validation remain separate decisions and are not implied by the production playground.

## Coverage

| Requirement | Status | Evidence boundary |
| --- | --- | --- |
| Rename active product and archive old Aeliqo | Satisfied | Filesystem, parent manifests, portfolio source, archive fingerprint and Git history |
| Semantic reuse and data correctness | Satisfied locally | Core semantic/temporal/relation tests and two unrelated domain fixtures |
| Level 1, Level 2, and Level 3 architecture | Satisfied locally | Sixteen catalog components plus Workspace; direct and semantic authoring paths |
| Data, component, interaction, and workspace smartness | Satisfied locally | Component, workspace, linked-data, persistence, and browser scenarios |
| Shared MCP/BYOK/WebMCP contracts | Satisfied locally | Shared dispatcher, parity tests, companion/MCP browser path, deterministic BYOK |
| Broad 118-need catalog | Not applicable as a delivery count | It is explicitly a planning and admission map |
| Full candidate grammar and all future layouts/predicates | Unmet by design | Broader than the executable bounded POC; requires admitted use cases |
| Package and CSS isolation | Satisfied locally | Tarball consumer, SSR/types/import graph, scoped-theme tests |
| Performance targets | Satisfied for admitted local workloads | B02 100k×20 Table and B03 50k-point Trend sampling measured in one production Chromium environment; resize/brush and other devices remain untested |
| Native WebMCP, live paid provider, external users | Unknown | Required external host, credential, and participants absent |
| Production playground deployment | Satisfied | Exact hosted validation/release, immutable digest, GitOps, two ready replicas, and apex/www checks |
| Public OSS/package release | Not applicable | Requires separate owner license and publication decisions |

## Remediation outcome

Authorized local remediation completed the identity migration, archive preservation, parent and portfolio records, component API/documentation promotion, Comparison contract, semantic edge cases, host-safe CSS, accessibility checks, and explicit implementation/evidence maps. Independent review then found two issues: virtual Table navigation lacked an accessible active-row announcement, and Comparison duplicated tabular rendering instead of composing a Level-1 primitive. Table now announces the active logical row, and Comparison composes the Level-1 Table while retaining controlled selection and honest unit/null behavior.

The final integrated `pnpm check` passed 156/156 unit and integration tests, all dependency boundaries, production build, 9/9 production-browser scenarios, and the core operation benchmark. `pnpm check:packages` built and installed five private 0.2.0 tarballs, type-checked their NodeNext declarations, server-rendered all eleven direct components, and retained no unwanted modules in the standalone Metric graph. `pnpm proof:stress` passed ten scenarios with the frozen catalog hash unchanged. The Arconath site independently passed 5/5 tests, lint, typecheck, production build, its build contract, and a production-dependency audit with zero known vulnerabilities.

Local B02/B03 evidence records a 100,000-row × 20-column Table at 23 DOM rows and a 50,000-point Trend at 793 visual points with exact full-data summaries. Gap continuity is preserved; when an 800-point geometry budget cannot preserve every gap, the line is withheld with an explanation. The recorded Apple M4 Pro/Chromium samples were Table 34.0 ms median / 35.7 ms p95 and Trend 65.4 / 65.5 ms, with 10,504 bytes retained growth after forced GC across 25 alternating lifecycles. Resize/brush, other devices/browsers, native WebMCP, live provider, external-user, commercial, license, and package-publication evidence remain explicitly outside these results. Production delivery evidence is recorded by platform GitOps and `platform-infrastructure/evidence/aeliqo-runtime.json`.
