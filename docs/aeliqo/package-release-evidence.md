# Package release evidence

## Candidate boundary

Only these packages are eligible for the first public package release:

- `@aeliqo/core`
- `@aeliqo/react`
- `@aeliqo/mcp`
- `@aeliqo/byok`
- `@aeliqo/webmcp-experimental`

The playground, companion, repository scripts, fixtures, and internal tooling are not part of the package allowlist. The owner selected Apache-2.0 for the repository and these five packages. Source manifests retain `private: true` as an accidental-publication guard. Only `AELIQO_PUBLIC_RELEASE=1`, used by the protected release workflow, emits reviewed artifacts with `private: false`; the default build remains non-publishable.

## Reproducible verification

`pnpm check:packages` performs the following checks against generated package contents rather than workspace source aliases:

1. removes the previous package build and tarball directories, then builds ESM and TypeScript declarations from public entry points and their reachable internal modules;
2. verifies Apache-2.0 metadata, embedded LICENSE/NOTICE, exports, CSS side effects, README inclusion, the five-package allowlist, and absence of `workspace:` or `link:` dependency specifications;
3. runs `npm pack --json`, inspects each tarball allowlist, and records npm integrity plus SHA-256;
4. creates consumers under the operating system temporary directory and installs Aeliqo tarballs as files while fetching every third-party dependency from the npm registry;
5. type-checks, executes, and builds a non-AI service-operations example; runtime assertions verify a primitive, Comparison, Workspace, theme customization, and manual linked selection from the tarball-installed modules;
6. checks standalone Metric bundle isolation and imports every protocol adapter without making a provider request;
7. launches the tarball-installed `aeliqo-mcp` executable on an ephemeral loopback port and waits for bridge readiness; it also copies the documented local BYOK server recipe into that consumer, checks it with TypeScript NodeNext resolution, and starts/stops it with a deterministic provider;
8. builds and runs Next.js App Router consumers, verifies server-rendered output, hydrates them in Chromium, and performs a client selection;
9. builds a second production entry from the React 19 tarball consumer, then measures a 100,000-row Table and 50,000-point Trend from installed package bytes. It records data preparation/query time, React Profiler `actualDuration`, browser-observable time, Chromium script/layout totals, geometry bounds, and cleanup separately.

The complete machine-readable result is written to the ignored local artifact `artifacts/package-evidence.json`. It records the source commit, dirty-tree status, package contents, hashes, exact dependency versions, consumer directories, executed results, and installed-artifact performance bound to every package SHA-256. A release candidate is traceable only when that report says the source tree was clean.

`docs/evidence/package-performance-baseline.json` stores accepted baselines by OS/architecture, Node major, Chromium major, and package hashes. Set `AELIQO_RECORD_PACKAGE_BASELINE=1` only after investigating and accepting a representative run. Set `AELIQO_ENFORCE_PACKAGE_PERF=1` to reject a missing matching profile or a measured median/p95 regression over 10%. A non-publishing workflow run is the bootstrap path for a new GitHub runner/browser profile; its evidence must be reviewed and committed before publication can use that profile.

The production React renderer does not emit `<Profiler onRender>` callbacks, so installed-artifact evidence records React `actualDuration` as unavailable rather than mislabeling zero. It still keeps data-query, browser-observable, script, and layout measurements distinct. The existing instrumented React evidence remains a separate renderer measurement; neither `commitTime` nor two animation frames is described as browser paint duration.

## Verified compatibility

| Consumer | Exact verified pair | Checks |
| --- | --- | --- |
| React + Vite | React/React DOM 18.3.1, types 18.3.x, Vite 7.3.0 | declarations, production build, Node SSR |
| React + Vite | React/React DOM 19.2.8, types 19.2.x, Vite 7.3.0 | declarations, production build, Node SSR, adapter imports, import isolation |
| Next App Router | Next 15.5.25 + React/React DOM 18.3.1 | production build, server output, browser hydration, client interaction |
| Next App Router | Next 16.3.4 + React/React DOM 19.2.8 | production build, server output, browser hydration, client interaction |

The package peer range is React and React DOM `>=18.3.0 <20`. The exact rows above are the tested configurations; the peer range is not a claim that every Next.js and React version combination is supported. Local verification currently runs on Node 24; the repository quality workflow supplies the separate Node 22.22 check for the declared `>=22.12` engine floor.

The distributed stylesheet now uses compatible flex alignment values; rerun the clean package matrix on the final source candidate to refresh the artifact hashes and confirm the earlier Next 15 Autoprefixer warnings are gone.

The manual `npm-release.yml` workflow uses a GitHub-hosted runner, OIDC permission, a protected `npm-release` environment, provenance, and the same five-package allowlist. Its verification path runs the complete cross-browser quality suite before producing package evidence. With `publish: false`, generated artifacts retain `private: true`. With `publish: true`, the verify job emits Apache-2.0 public metadata, requires a matching accepted performance profile, and uploads the reviewed tarballs with their evidence.

The protected publish job does not check out source, install repository dependencies, or rebuild packages. It downloads that exact verify-job artifact, checks the source commit, clean-tree record, allowlist, public metadata, embedded license, MCP executable, and each SHA-256 against the evidence, then publishes the named tarball bytes in dependency order.

An external MCP client can launch the package with `npx --yes @aeliqo/mcp` or the installed `aeliqo-mcp` executable. `AELIQO_BRIDGE_PORT` selects the loopback bridge port; `0` requests an ephemeral port. `AELIQO_WORKSPACE_ID` and `AELIQO_RENDERER_ID` set the explicit pairing identity. The companion application remains internal.

## Remaining publication gates

- Confirm npm scope/name ownership and choose the release dist-tag. Version `0.2.0` is the current candidate.
- Run the complete quality workflow from a clean committed source revision.
- Review the dependency/ownership inventory in `docs/aeliqo/dependency-license-audit.md`; it is engineering evidence rather than legal advice.
- Bootstrap and accept the GitHub-hosted installed-artifact performance profile before a protected publish run.
- After publication, repeat the consumer matrix from registry package specifications and record registry integrity and live website smoke evidence.
