# 16 — Quality and evidence gates

## Evidence ladder

Specification -> implemented source -> deterministic tests -> browser behavior -> built artifact consumers -> real transport/provider evidence -> operational candidate -> published/live verification. Each is different. A mocked provider, simulated host, unchecked screenshot or historical v0.2 result cannot skip a step.

## Required test classes

**Contracts:** schema generation parity, version migrations, strict unknown-field rejection, bounded inputs, error paths and public type tests.

**Semantics/query:** property and metamorphic tests for identity/grain/unit/null/ratio/time, cardinality/fan-out, stable ranking, aggregation associativity where valid, group order invariance, duplicate records, calendar boundaries and exact/approximate scope. Local and HTTP executors must match independent expected results.

**Runtime:** concurrent tasks, outdated proposals, request replay, abort races, reentrant subscriptions, disposal, backpressure, cache partitioning, permission revocation, incremental propagation and transaction rollback.

**Components:** every required catalog entry, all appropriate states, direct/semantic/compound parity, controlled input behavior, keyboard/touch/IME, focus and draft persistence, portal/shadow form semantics and no unintended global CSS.

**Presentation:** constraint conflict, permitted adaptation, task operation preservation, pinned views, text/zoom/RTL, changing cardinality, stable incumbent, no fake confidence, cold SSR sizes and budget exhaustion.

**Web:** Chromium/Firefox/WebKit plus recorded supported browser versions; native form behavior, SSR/hydration, current React and framework-free consumers, minimal Vue custom element interoperability, streaming and error recovery. The thin wrapper is not allowed to hide a second implementation.

**Visual/a11y:** approved controlled baselines, diff review, contrast/focus/reading order, large text/reflow, dense plot alternatives and every gallery state. Automated a11y tools do not prove full compliance. Manual assistive-technology certification is a post-0.1.0 improvement rather than a release gate, and the release must not claim that certification.

**Agents:** direct/MCP/WebMCP/BYOK contract parity, malformed/hostile tool inputs, explicit target binding, receipts/cancellation; independent actual client/provider/native-host runs.

**Supply chain/release:** npm pack content and types, tree shaking, browser/server separation, SBOM/license, secret scan, exact tarball consumer, immutable image, production identity and rollback.

## Release gates

G00 toolchain/model/runtime audit and rendering feasibility; G01 contracts/semantic/query correctness; G02 result/runtime isolation; G03 complete catalog + compiled examples; G04 adaptive task-preserving UX/a11y; G05 performance/bundle/retention; G06 agent real-world evidence; G07 external DX/design review; G08 package and operational release; G09 post-publish/live verification.

Some gates involve external people/credentials. The agent should complete all available work and report unavailable gates as blocked. “Cannot test native WebMCP here” is not permission to label it stable; keep it experimental and accurately disclose its evidence boundary. A release can have an explicitly documented experimental adapter, but it cannot claim native validation it lacks.

## Artifact identity

Evidence records include task, commit/tree identity, command/test runner, environment, artifact paths + SHA-256, observed outcome, reviewer identity/role and timestamp. A release evidence bundle is produced after implementation and ties to the candidate source tree. Do not store only prose saying “all passed.” Final CI verifies the evidence on the candidate and produces an attestation; user-editable JSON is not a security certificate.

## Gate implementation

The kit includes a conservative structural release gate which rejects planned tasks/components and missing evidence. M0 must wire product tests and artifact checks into real CI; modifying a task status does not replace those commands. Never use `--passWithNoTests`, unscoped skip patterns or always-green mocks. Gate script checks are a harness aid, not tamper-proof proof.

Keep test command definitions in one manifest and generate CI/docs references from it where practical. A missing executable test is a failure, not a skipped success. Test quarantines require issue/reason/owner/expiry and cannot hide release-critical behavior.

## Independent review

Critical semantics/security/runtime/rendering changes require review by an agent that did not author them. At release, run a second adversarial review across complete user journeys and artifacts. Human design/accessibility review is recorded separately. Fix blockers, add regressions and rerun integrated gates.

## Failure reporting

Report implemented, validated, published, deployed and blocked separately. Counts use actual tests/entries, not duplicated variants inflated into achievements. Benchmark budgets remain targets until measured. Public docs carry a support matrix based on actual package/browser evidence, not permissive peerDependency ranges.

## Master consolidation release-quality intelligence

A named early deterministic end-to-end slice must run before catalog-wide work, followed by real-provider held-out evaluation as soon as authorized credentials permit. This is an ordering rule, not a reduction of the release catalog. Required evaluations include unseen compositions without presets, multiple output grains, fixed/live cohorts, query-only versus presentation-only effects, no-AI interactions, stale user/agent conflicts, narrative grounding and adversarial constraints.

The revision adds executable **reference probes**, independent numeric oracles and stronger harness checks. They validate their bounded models and counterexamples, not the future runtime. Product tests must reuse the vectors against actual public built packages, compare independent expected outputs, and produce source-bound evidence.

Candidate identity includes product sources, contract/test scripts, design inputs, build/tool configs, quality command definitions and acceptance requirements. Mutable status/evidence/review fields are normalized out to avoid circular identity; changing acceptance criteria, command argv, profile, dependency or test config invalidates old evidence. Individual task/component status does not become a certificate merely because artifact hashes exist.

The executable gates use `ready` (prepublication candidate) and `release` (publication plus live verification). Within release evidence, source/package publication and deployment remain separate claims; `deployed` is a reporting state, not an extra CLI mode. Do not create an impossible ready gate that requires an already released website. Native WebMCP stays experimental when native environment evidence is unavailable; its adapter contract still requires tests.

## Master edition 1 — canonical references

Include chapter37 AC-M01–12: invalid and valid-but-wrong proposals, forged authority, permitted scope/default, model-free recovery, revoked-data clearing, exact narrative values and no-progress budgets. Reference probes demonstrate selected rules; T41/T40/T39provide product evidence. No model or validator score establishes zero hallucination.

[Master](../MASTER-SOT.md) · [AI contract](37-model-failure-containment.md) · [Release](18-release-migration.md).
