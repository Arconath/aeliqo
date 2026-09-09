# T32 independent architecture, DX and usability audit

## Scope

- Repository source state reviewed: `c5b33c1b931f07289caffa1034d70bc6e3af16eb`
- Candidate source digest: `9afbd73d926c9a08e1713c2b72c767a9f54d63f1a7fcbf15bd5256cbb94b7e03`
- Reviewer: independent read-only Luna Max agent `01a08776-0ec0-7962-b15b-f20276ad69b4`
- Criteria: `MASTER-SOT.md`, `docs/16-quality-gates.md`, `docs/37-model-failure-containment.md`, `docs/38-public-site-docs-playground.md`, `docs/39-discussion-ledger.md`, and `harness/tasks.json`.

No files were edited, staged, or committed by the reviewer. This is an audit record, not a release approval.

## Findings

No P0 finding was observed in the sampled source. The following P1/open findings remain:

1. T32 is still planned and has no completed review/approval; it depends on incomplete T29, T30 and T31.
2. T29 has automated browser/Axe coverage but lacks human visual/design approval and manual assistive-technology review.
3. T30 remains active; cold-start, device, paint, whole-page and manual performance qualification are open, and the checked-in CI evidence is stale for the current candidate.
4. T31/T40 do not contain authorized provider/model, held-out intent, narrative-grounding, UI-completion or ablation evidence.
5. S65, S66 and S67 remain planned even though local code-only and meaning-authoring consumer runs provide implementation evidence.
6. T42 remains blocked because registry history, namespace authority and exact 0.1.0 collision proof cannot be established from E404/E401 responses.

## Requirement classification

| Area | Classification | Boundary |
|---|---|---|
| Four-concept/core-runtime separation | Satisfied, sampled | Source and boundary tests inspected; not a universal architectural certification. |
| Core free of DOM/framework/provider/database effects | Satisfied, sampled | Import boundaries and security tests inspected. |
| Bounded data-to-output-to-UI slice | Satisfied, bounded | T39 and vertical consumer evidence. |
| Local model-failure containment and independent grants | Satisfied for local boundaries | T41 and agent capability/binder source; not real-provider quality. |
| Valid-but-wrong intent, prose grounding and real model behavior | Unknown | No authorized provider evaluation. |
| Developer code-only meaning path | Implementation evidence satisfied; formal scenario unmet | Meaning consumer passes, but S65–S67 remain planned. |
| Automated 71-component coverage | Satisfied for sampled automation | Human visual, AT and exhaustive state review remain open. |
| Site/docs/playground implementation | Satisfied for checked-in implementation | Independent human/device qualification remains unknown. |
| Local package, license, SBOM and consumer evidence | Satisfied, local/source-bound | No registry publication or RC verification. |
| Exact 0.1.0 reset and namespace history | Unmet/blocked | T42 read-only evidence. |

## Coverage and limits

Inspected representative core/runtime/web/agent source, boundary tests, package/consumer reports, T29/T30/T31/T33/T40/T42 evidence, current task/scenario manifests, and the named governing documents. This review did not perform human interviews, manual screen-reader operation, lower-powered-device testing, authorized provider calls, or registry mutations. Automated tests and local tarballs do not substitute for those evidence classes.

## Disposition

T32 remains `planned`; this audit supplies independent gap evidence but does not approve T32 or the release. The smallest next steps are to complete S65–S67, obtain human visual/AT/DX evidence, refresh current-candidate CI/performance evidence, run authorized held-out provider evaluation, and resolve T42 with an authorized registry identity and historical availability evidence.
