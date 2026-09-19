# Validation report — final-v3

Date: 2026-09-19. This is evidence for the **planning artifact**, not qualification of an implemented Aeliqo vNext product.

## Observed inputs

- All eight v2 Markdown documents and its archive manifest were read. The v2 archive integrity passed; the audit still found design/contract contradictions.
- Current `Arconath/aeliqo` main was read through the GitHub connector and resolved to `9092d6cff454b81cd623a7a4be7621c6a750d9c7`. Selected source/AGENTS boundaries were rechecked; this was not an exhaustive codebase execution audit.
- Primary references were checked for React external stores/lifecycle, multi-tenant authorization, model compatibility, web accessibility, and Codex execution plans. See `04-RESEARCH.md`.

## Actual local checks

| Check | Observed result | What it does not prove |
|---|---|---|
| Task graph and plan headings | 22 tasks, T00–T21; dependencies agree; acyclic | That tasks are implemented |
| Requirement ownership | 46 requirements, RQ01–RQ46; acceptance rows and task owners agree | That behavior passes |
| Checkpoint/version/fences | Initial checkpoint lists every task as not-started; final archive names consistent; code fences balanced | Every prose claim or future package import is correct |
| Declaration-only TypeScript probe | Exit 0 with strict, noUncheckedIndexedAccess and exactOptionalPropertyTypes; eight expected invalid uses checked | Real package compilation, React runtime behavior, or every Markdown snippet |
| Type negative control | Removing the expected-error annotation for a feature passed as a surface caused TS2739 and exit 2 | Runtime input validation |
| Pack negative controls | Six intentional corruptions rejected; diagnostics listed below | A signature or security sandbox |
| Final integrity | SHA-256/byte inventory verified; ZIP CRC and payloads compared with final directory | Publisher authenticity or product readiness |

### Negative controls

| Intentional corruption | Observed rejection |
|---|---|
| changed spec bytes | `Byte length mismatch: 01-SPEC.md` |
| missing requirement row | `Acceptance rows do not cover RQ01-RQ46 once` |
| cyclic dependencies | `Dependency cycle at T00` |
| obsolete archive reference | `Missing final archive name: 05-CODEX-PROMPT.md` |
| unclosed code fence | `Unclosed code fence: 08-CONTRACTS.md` |
| archive traversal extra entry | `Archive inventory mismatch` |

Checks were run against temporary copies; the final files do not contain these corruptions. During authoring, a greedy Markdown task-title regex in the validator was found to capture one large section instead of 22. The parser was corrected to match a single title line, and the full check plus negative controls was rerun successfully. This was an authoring-tool defect, not a tested product defect.

## Reproduce the artifact checks

From the unmodified extracted pack:

```sh
python3 verify_pack.py
python3 verify_pack.py --archive ../aeliqo-vnext-final-v3.zip
```

The optional ZIP path is relative to where the user actually stores the archive. The validator does not extract, execute the TypeScript, contact the network, or edit the pack. Read it before use. Manifest checks describe the initial handoff; legitimate execution-checkpoint edits later make the original checksum differ and must be reconciled explicitly.

The isolated design probe command executed was:

```sh
tsc --strict --noEmit --noUncheckedIndexedAccess --exactOptionalPropertyTypes \
  --target es2022 --module esnext --lib es2022,dom contracts/contract-probe.ts
```

Authoring environment: Python 3.13.5, v22.16.0, TypeScript 5.8.3. These are the authoring tools, **not** the repository-pinned support matrix. Codex reads the repository toolchain in T00.

## Explicitly not performed

No Aeliqo source change, implementation build, real package consumer, browser/UI/security/performance test suite, live provider evaluation, real developer usability study, or production traffic qualification was performed in this planning revision. No repository write, branch change, model spend, npm publication, GitOps mutation or production deployment occurred.

The included model defines reference types only. It must never be substituted for the real core/runtime/renderer or used to label any requirement implemented. All 46 product requirements remain NOT EXECUTED until their Codex task evidence exists. Independent implementation review is also not established by this artifact self-check.

## Artifact coverage

The manifest hashes each other delivered file, including this report and the verifier, but cannot hash itself. `PLAN-INDEX.json` contains the old-to-new task mapping for preserving v2 checkpoints. `09-AUDIT.md` records 15 plan findings and their resolutions. Use the final pack as one consolidated replacement, not as a patch to selectively mix with v2 snippets.
