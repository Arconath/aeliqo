# Aeliqo — master foundation 0.1.0

**Status: 0.1.0 release candidate. Registry and production availability are verified separately from source readiness.**

Aeliqo is an opinionated adaptive application UI framework with its own complete primitive and 2D components. User intent and application-owned data become governed, interactive experiences. AI may be wrong: its proposals must pass explicit contracts. Contract validity is not proof that every interpretation or business claim is true.

Start with [MASTER-SOT.md](MASTER-SOT.md), [START-HERE.id.md](START-HERE.id.md), [AGENTS.md](AGENTS.md), and [PROMPT-START.md](PROMPT-START.md). The [chapter map](docs/README.md) supplies technical depth. The [discussion ledger](docs/39-discussion-ledger.md) reconciles earlier corrections and misleading infographic claims.

## What this package delivers

Catalog / Task / Result / Experience; one application data contract with local and HTTP paths; a bounded query model; AI-assisted/manual meaning; pattern-assisted composition without mandatory templates; three distinct graph types; a shared web realization; complete 71-component scope; source and model permission boundaries; a design/site/playground specification; OSS-to-business plan; Codex prompts, ownership-aware work orders and reference counterexamples.

Run the kit checks before editing:

```sh
python3 scripts/verify_integrity.py
python3 scripts/validate_all.py
```

Requires Python 3.11+; reference type tests also require Node and TypeScript's `tsc`. Production dependencies and browser matrix are verified and pinned during M0, not fabricated in this foundation. `validate_all.py` tests the kit, not the future runtime. See [VALIDATION.md](VALIDATION.md) for actual results and limits.

The latest product target is **0.1.0**. It supersedes earlier 0.10 planning; contract schema version 1 is independent. The rewrite uses the clean `@aeliqo/sdk-{core,runtime,web,react,agent,devtools}` identity family, while `@aeliqo/testkit` remains a private workspace. Published npm identities are immutable, and a lower semver is not an automatic upgrade for previous users. [Release migration](docs/18-release-migration.md) defines collision checks and cutover; [the 0.1 migration guide](docs/migration-0.1.0.md) maps the incompatible 0.2 packages.

A clean source tree is intentional. Preserve historical commits and rollback artifacts; remove legacy implementation from the new active tree rather than deleting customer data or breaking a live service first. Publication uses audited tarballs, non-latest staging tags, clean registry consumers, and an explicit final promotion; source presence alone is not a publication claim.

## License and product boundary

Apache-2.0 for the complete runtime/components/basic security/accessibility/local tools and protocol integration. Hosted organizational collaboration/governance/operations and enterprise support are a separate commercial service. No safety paywall, runtime license callback or artificial paid row cap.

The exact boundary and availability language are documented in [OSS and commercial boundary](docs/business/oss-commercial-boundary.md) and [0.1.0 support boundary](docs/public/0.1.0-support-boundary.md).

## Specification edition 1.1

Developer-authored typed code/config is a first-class manual meaning surface. Product target remains 0.1.0; no core redesign or new evaluator. See [correction summary](CORRECTION-DEVELOPER-MEANING.md).
