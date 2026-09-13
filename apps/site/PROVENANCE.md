# Site source provenance and reunification

- Public source repository: `https://github.com/Arconath/aeliqo`
- Audit baseline: `4970c7e7b06530f1e0a2a3f69a93c9c812e6da46`
- Public artifact producer commit: `fb16bc90965b117f77d7c09974eecdedf26d2f6a`
- Vendored SDK version: `0.1.0-rc.2`
- Public docs artifact SHA-256: `5d47295e906fa4659690ab733dfe479b0318edb69baca38ab03c17f6a879d7fd`
- Extraction manifest: `docs/repository-split-manifest.json` in the public repository

The site source under `src`, its static templates, tests, server, and delivery
scripts were extracted from the public artifact-producer commit above into the
former private site repository. On 13 September 2026 the reviewed current site
source was copied back to `apps/site` in the public repository. The private
repository's full refs were preserved in an external bundle before retirement.
Vendored
package bytes, their SBOM, secret scan, installed-consumer report, and candidate
manifest are preserved under `vendor/packages`. Public docs and example inputs,
including complete checksums, are preserved under `vendor/public-docs`.

The candidate manifest reports 130 installed export checks, 63 SBOM components,
and zero candidate/source secret findings. These are artifact facts, not proof
of npm publication or production deployment.

Pull-request and main quality now run on GitHub-hosted runners with read-only
source permissions. The required site gate covers input integrity, type/unit,
browser correctness, docs navigation, responsive/document behavior, server and
provenance tests. Performance qualification remains deferred by owner direction;
the historical tests and budgets are preserved but are not a current required
gate. The owner-dispatched public release uses hosted BuildKit, records the
immutable digest and attached provenance, and performs one pinned Trivy SBOM plus
HIGH/CRITICAL scan. Publication does not grant deployment authority.
