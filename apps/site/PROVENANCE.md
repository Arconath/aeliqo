# Extraction provenance

- Public source repository: `https://github.com/Arconath/aeliqo`
- Audit baseline: `4970c7e7b06530f1e0a2a3f69a93c9c812e6da46`
- Public artifact producer commit: `fb16bc90965b117f77d7c09974eecdedf26d2f6a`
- Vendored SDK version: `0.1.0-rc.2`
- Public docs artifact SHA-256: `5d47295e906fa4659690ab733dfe479b0318edb69baca38ab03c17f6a879d7fd`
- Extraction manifest: `docs/repository-split-manifest.json` in the public repository

The site source under `src`, its static templates, tests, server, and delivery
scripts were extracted from the public artifact-producer commit above. Vendored
package bytes, their SBOM, secret scan, installed-consumer report, and candidate
manifest are preserved under `vendor/packages`. Public docs and example inputs,
including complete checksums, are preserved under `vendor/public-docs`.

The candidate manifest reports 130 installed export checks, 63 SBOM components,
and zero candidate/source secret findings. These are artifact facts, not proof
of npm publication or production deployment.

Quality runs directly on a fresh, isolated R640 quality slot with the exact
Node, pnpm, Go, and Playwright toolchain and executes the complete browser/server
suite. It builds and smoke-tests the production image on that slot's rootless
Docker daemon without rebuilding the test toolchain inside an image. The release
pipeline runs on the separate trusted R640 rootless BuildKit pool and requires
that same exact main revision to have passed quality,
adds SLSA v1 provenance to the OCI result, records the immutable digest and
source/SDK identity, fetches the attached attestation back from GHCR, and rejects
any subject, builder, VCS, build-argument, or predicate mismatch. It retains the
exact in-toto statement and performs one pinned Trivy SBOM plus HIGH/CRITICAL scan.
Publication does not grant deployment authority.
