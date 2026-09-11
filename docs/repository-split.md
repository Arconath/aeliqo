# Public framework and private website split

`Arconath/aeliqo` remains the complete Apache-2.0 framework. Its packages,
runtime, evaluator, semantic and presentation validators, web/React bindings,
agent plumbing, local Studio, devtools, source testkit, examples, developer
documentation source, and conformance coverage do not depend on the private
website repository.

`Arconath/aeliqo-site` owns only the website presentation shell, static server,
container, site tests, and site deployment workflow. Before registry publication,
the site installs the exact verified Aeliqo candidate tarballs committed to its
private `vendor` directory. It also verifies the public documentation artifact's
SHA-256 digest before generating routes. A sibling SDK checkout, a mutable branch,
or an npm `latest` tag is not a supported build input.

The machine-readable [extraction manifest](./repository-split-manifest.json)
records each source path, destination, reason, dependency, test owner, and
provenance. Historical evidence remains in place; it is not recast as evidence
for either repository's post-split source.

## Independent gates

- A fresh public clone installs and runs SDK builds, package consumers, public
  documentation validation, browser tests, and the release candidate producer
  without a private repository or token.
- A fresh private clone installs and builds the whole 96-route site from vendored
  exact package artifacts and the verified public documentation input without a
  sibling framework checkout.
- Public pull requests run on GitHub-hosted Actions with read-only repository
  permission and receive no production, private-site, npm-publish, or GitOps
  credential.
- Package publication and website deployment remain separate owner-authorized
  effects. Neither one proves the other occurred.

Production authority stays on the old path until the private repository has a
successful exact-main quality run, immutable image evidence, reviewed GitOps
change, Flux reconciliation, and route/header/health smoke. The previous image
digest and GitOps revision are the rollback inputs.

## Cutover record

The private-site cutover completed on 11 September 2026. The production site is
built from private site revision `f7e692b18f8168487c6aa53e606b0b1ceef728b8`,
public SDK revision `fb16bc90965b117f77d7c09974eecdedf26d2f6a`, and
SDK version `0.1.0-rc.2`. UpCloud selects immutable image digest
`sha256:843c81baf2696039fc36b8209191ebc5cfce74c4fe06d5cce7898422a4c7de09`.

Normal GitOps pull requests
[166](https://github.com/Arconath/platform-apps/pull/166),
[167](https://github.com/Arconath/platform-apps/pull/167), and
[168](https://github.com/Arconath/platform-apps/pull/168) record the initial
cutover, production CSP correction, and live acceptance. Apex and `www` exposed
the exact site/SDK identities; route, health, readiness, 404/method, cache/CSP,
and live browser checks passed. Direct authenticated Flux/Kubernetes inspection
was unavailable, so the evidence distinguishes exact live convergence from an
observed controller-status claim. The unchanged shared runtime remains the
last-known-good rollback path.
