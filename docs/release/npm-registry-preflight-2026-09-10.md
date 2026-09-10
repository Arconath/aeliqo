# npm registry preflight — 10 September 2026

The opening inventory below is a read-only observation of `https://registry.npmjs.org/` made earlier on 10 September 2026. No package was changed during that observation. The final section records the later owner-directed publication attempt and registry deletion; it supersedes the opening inventory as current state.

## Existing Aeliqo lineages

| Package | Visible versions | Dist-tags | Deprecation | Published (UTC) |
|---|---|---|---|---|
| `@aeliqo/core` | `0.2.0` | `latest=0.2.0` | none | 2026-09-06 20:02:44 |
| `@aeliqo/react` | `0.2.0` | `latest=0.2.0` | none | 2026-09-06 20:02:55 |
| `@aeliqo/mcp` | `0.2.0` | `latest=0.2.0` | none | 2026-09-06 20:03:02 |
| `@aeliqo/byok` | `0.2.0` | `latest=0.2.0` | none | 2026-09-06 20:03:10 |
| `@aeliqo/webmcp-experimental` | `0.2.0` | `latest=0.2.0` | none | 2026-09-06 20:03:16 |

At the time of the opening observation, the public packuments named `arconath` as maintainer and pointed to `Arconath/aeliqo`. This public metadata did not prove the observing process was authenticated as that account.

At the time of the opening observation, the concise `@aeliqo/runtime`, `@aeliqo/web`, `@aeliqo/agent`, `@aeliqo/devtools`, and `@aeliqo/testkit` names returned HTTP 404. The direct `@aeliqo/core@0.1.0` and `@aeliqo/react@0.1.0` version requests also returned 404, while those names still exposed the incompatible higher-semver lineage.

## Superseded clean-identity proposal

The initially proposed uniform candidate names returned HTTP 404 at this observation time:

- `@aeliqo/sdk-core`
- `@aeliqo/sdk-runtime`
- `@aeliqo/sdk-web`
- `@aeliqo/sdk-react`
- `@aeliqo/sdk-agent`
- `@aeliqo/sdk-devtools`

An anonymous 404 proves only that a package/version is not publicly visible at that instant. It cannot rule out a prior unpublish, a private package, namespace policy, or a first-publish rejection. A unique RC publication remains the authoritative availability test.

## Authentication and remaining external work

Authentication is toolchain-dependent on this host. The default Node 22/npm 10 invocation returned HTTP 401, but the pinned release toolchain (Node 24.20.0, npm 11.19.0) authenticated as `arconath`. Its read-only access inspection reported `arconath` as owner of the `aeliqo` organization and read-write access to all five visible legacy packages. The account reports two-factor authentication for authorization and writes. No secret value was inspected or recorded.

This establishes current scope ownership and legacy-package access under the pinned toolchain. It does not prove that npm will accept any particular absent package name or version; only the authorized first RC publication can close that check.

After all source-bound release gates pass, an authorized release operator must publish a unique `0.1.0-rc.N` set under `next`, install and verify the exact registry artifacts, publish stable `0.1.0` under `rewrite`, and verify the full set again. The allowlisted `scripts/release/deprecate-legacy.mjs --apply` operation verifies the exact obsolete lineages and compares every stable replacement registry integrity before changing metadata. Dist-tag promotion and production deployment remain later, explicit operations.

## Owner-directed identity update and registry mutation

Later on 10 September 2026, the owner explicitly selected the concise package family: `@aeliqo/core`, `@aeliqo/runtime`, `@aeliqo/web`, `@aeliqo/react`, `@aeliqo/agent`, and `@aeliqo/devtools`. A bootstrap attempt had already published only `@aeliqo/sdk-core@0.1.0-rc.1`; its integrity matched the reviewed tarball, but npm also created `latest` automatically on that first package identity. Publication stopped before package two. That artifact is now an abandoned wrong-name prerelease and must not satisfy direct-name release gates.

At the same update, `@aeliqo/core@0.2.0` was first marked deprecated. The owner then manually unpublished every package in the organization. A fresh authenticated access listing returned an empty object and all direct, legacy, and `sdk-*` names returned 404 at `2026-09-10T16:32:51Z`. This removes registry installation availability but does not make any historical name+version reusable. npm also blocks publishing any new version under a completely unpublished package name for 24 hours; the conservative direct-name retry time is therefore no earlier than `2026-09-11T16:32:51Z`, followed by a fresh authenticated preflight.
