# Website repository history and reunification

## Current ownership — 13 September 2026

`Arconath/aeliqo` is the single public source repository for the Apache-2.0
framework, packages, runtime, evaluator, semantic and presentation validators,
web/React bindings, agent plumbing, Studio, developer documentation, website,
docs routes and playground. Public source lives in `apps/web`, `apps/docs` and
`apps/playground`. The `apps/site` shell retains the isolated package inputs,
static assembly/server, browser checks and image delivery.

The site keeps an isolated lockfile and exact vendored `0.1.0-rc.2` package/docs
candidate so the already-reviewed production input remains reproducible during
the repository transition. This is a temporary release input, not a second
framework source. New framework and documentation work starts in the canonical
root source and must refresh the site input through a reviewed release step.

Public pull requests run only on GitHub-hosted runners with read-only source
permission and no npm, GHCR-write, GitOps or production credentials. Package
publication, website image publication, GitOps promotion and live deployment
remain separate claims and effects.

## Historical split — 11 September 2026

The website shell was previously extracted to private `Arconath/aeliqo-site`.
That repository consumed checksum-verified package tarballs and a generated
public docs artifact without sibling-checkout imports. The machine-readable
`repository-split-manifest.json` remains as provenance for that extraction and
must be read as historical evidence.

The production cutover used private site revision
`f7e692b18f8168487c6aa53e606b0b1ceef728b8`, public SDK revision
`fb16bc90965b117f77d7c09974eecdedf26d2f6a`, SDK `0.1.0-rc.2`, and image digest
`sha256:843c81baf2696039fc36b8209191ebc5cfce74c4fe06d5cce7898422a4c7de09`.
GitOps pull requests 166–168 recorded the original cutover and CSP/live
acceptance. Those facts remain rollback evidence; they do not prove that the
new unified source has been released or deployed.

## Reunification controls

- The former private repository's complete refs were bundled before local
  retirement; ignored dependencies and generated outputs were not promoted to
  source.
- Current site sources, tests, exact vendored inputs and static delivery tooling
  were copied into `apps/site` without importing private Git history.
- The public workflow uses GitHub-hosted runners. Public PR code must never run
  on the private R640 runner.
- A new site image requires a successful exact-main functional-quality run, an
  owner-dispatched image build, immutable GHCR digest and scan/provenance
  evidence, then a reviewed GitOps digest change and runtime smoke.
- The old production digest remains the rollback target until the unified source
  completes those gates.
