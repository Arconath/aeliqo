# 17 — Repository structure and maintainability

## Target source layout

```text
packages/
  core/src/
    contracts/ semantics/ expressions/ query/ presentation/ diagnostics/
  runtime/src/
    tasks/ results/ regions/ interaction/ scheduling/ persistence/
  web/src/
    elements/ controllers/ patterns/ plot/ styles/ server/
  react/src/
    bindings/ types/
  agent/src/
    capabilities/ mcp/ webmcp/ byok/
  devtools/src/
    inspect/ studio/ import-export/
  testkit/src/
    contracts/ fixtures/ assertions/
apps/
  site/                     # marketing, docs, blog, reusable content pages
  playground/               # real runtime demonstration, no parallel logic
  studio/                   # local authoring shell, OSS
examples/
  vanilla/ react/ vue/ server-data/
fixtures/
  hr/ commerce/ adversarial/
tests/
  contracts/ semantics/ runtime/ browser/ visual/ consumers/ agents/ harness/
docs/
  adr/                      # decisions and evidence, not duplicate specs
harness/
  tasks.json components.json requirements.json evidence/ checkpoint.md
scripts/
```

This is a target layout, not permission to create hundreds of empty placeholders. Create a directory when implementing its first real vertical slice. Keep source modules cohesive, with explicit internal imports and public subpath exports.

## Seven public workspaces

`@aeliqo/core`, `@aeliqo/runtime`, `@aeliqo/web`, `@aeliqo/react`, `@aeliqo/agent`, `@aeliqo/devtools`, `@aeliqo/testkit`. Protocols are subpaths of the agent package; old v0.2 names have a documented migration, not silent compatibility promises. Testkit/devtools are optional development dependencies.

Do not make a package per operator, chart or provider. Do not put server-only MCP/provider dependencies in a browser-imported barrel. Optional subpaths and explicit peer/runtime dependencies must be tested against isolated built consumers; declaring sideEffects false does not fix an eagerly imported graph.

## Core rule

The pure core can run in a non-DOM JS environment. It contains no clock reads, network requests, provider calls or component effects during planning; required external facts enter through explicit arguments. It may use a small runtime validation dependency, but no platform-specific library leaks into public contracts.

Runtime is effect orchestration through ports. Web implements those ports and element behavior. React imports the web binding contract, not duplicated component source. Agent tools import core/runtime contracts and execute through the dispatcher. Apps/examples use public built APIs, not private source aliases.

## API discipline

Strict TypeScript (`strict`, exact optional properties and unchecked index access), explicit error unions, immutable public values, branded/opaque IDs where useful, no public `any`/`unknown` masquerading as a contract. Unknown is correct at untrusted ingress until validated. Do not make every field generic to appear flexible.

Runtime schemas are generated from one maintained definition system or have a verified roundtrip generation process. JSON Schema, TypeScript declarations and Studio editors must not drift. Public APIs have compile tests for inference and errors.

## Code organization

Prefer small concrete modules with clear responsibilities over generic factories and inheritance hierarchies. Extract abstractions after at least two real consumers prove the shared invariant. Do not hide domain decisions in utilities. No `manager`, `engine`, `service` classes that own every concern. Cross-cutting diagnostics/policy are explicit context inputs rather than global interception magic.

Every resource owner exposes cleanup. Every async call has error/cancellation behavior. Avoid catch-and-ignore except explicitly best-effort telemetry whose failure cannot falsify a committed task. Do not throw observer exceptions back as if an already committed business/view transaction failed.

## Source control ownership

The orchestrator owns contracts, lockfile, root config and integration branches. Task ownership scopes files for workers; conflicts are integrated deliberately. One atomic commit covers a coherent behavior change with tests/docs, not merely one file. Breaking contract changes land first with migration/tests before consumers parallelize.

## Documentation quality

README for public entry, full API docs generated from exports/schemas, hand-authored concepts and runnable recipes, support matrix, changelog and migration. Source comments explain invariants and nonobvious tradeoffs; they do not restate every line. Docs link to evidence and current implementation, not stale PoC claims.

Use local ADRs for decisions that affect boundaries, compatibility, significant performance or new dependencies. Do not create an ADR for trivial style choices. A doc check rejects broken links, unknown task refs and conflicting version/status claims.

## Master consolidation canonical ownership paths

All package implementation paths use `packages/<package>/src/...`; root package ownership such as `packages/react` is permitted for whole-package integration tasks. Core owns contracts, semantics/expressions, query, presentation and diagnostics. Plot **semantic specs** are core contracts; D3/geometry implementation stays under web/plot or an isolated non-core geometry module. Runtime subtrees include data, tasks, results, regions, interaction, actions, meaning, scheduling and presentation coordination.

The task graph and scheduler validate portable, nontraversing canonical paths. Path leases prevent simultaneous writers; the orchestrator still checks semantic dependencies. Shared configs/lockfile have one owner. Acceptance tests can be colocated under an owned source family or separately assigned; do not allow a worker to edit a shared test registry as an untracked side effect.

New sources/meanings/representations are extensions through the existing contracts. A new generic abstraction requires at least two real usage cases and a failing boundary that it resolves. Retain an explicit complexity budget: no new microservice, package, generic DSL, dependency or solver without a measurable benefit and ownership.

## Master source-of-truth ownership

MASTER-SOT.md governs product decisions; domain chapters supply detail. Schema/manifest generators and acceptance inventory must change together. Include master and concrete security/version policy in evidence digests. Source ownership uses canonical actual paths including src; tools must reject traversal/symlink escapes. docs/41-engineering-operating-standard.md is the code/review contract, not a license to generate hundreds of empty directories.
