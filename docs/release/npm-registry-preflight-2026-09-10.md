# npm registry preflight — 10 September 2026

This is a read-only observation of `https://registry.npmjs.org/` made on 10 September 2026. No package was published, deprecated, un-deprecated, un-published, tagged, or otherwise changed.

## Existing Aeliqo lineages

| Package | Visible versions | Dist-tags | Deprecation | Published (UTC) |
|---|---|---|---|---|
| `@aeliqo/core` | `0.2.0` | `latest=0.2.0` | none | 2026-09-06 20:02:44 |
| `@aeliqo/react` | `0.2.0` | `latest=0.2.0` | none | 2026-09-06 20:02:55 |
| `@aeliqo/mcp` | `0.2.0` | `latest=0.2.0` | none | 2026-09-06 20:03:02 |
| `@aeliqo/byok` | `0.2.0` | `latest=0.2.0` | none | 2026-09-06 20:03:10 |
| `@aeliqo/webmcp-experimental` | `0.2.0` | `latest=0.2.0` | none | 2026-09-06 20:03:16 |

The public packuments name `arconath` as maintainer and point to `Arconath/aeliqo`. This public metadata does not prove the current process is authenticated as that account.

The concise `@aeliqo/runtime`, `@aeliqo/web`, `@aeliqo/agent`, `@aeliqo/devtools`, and `@aeliqo/testkit` names returned HTTP 404. The direct `@aeliqo/core@0.1.0` and `@aeliqo/react@0.1.0` version requests also returned 404, but those names already carry the incompatible higher-semver lineage.

## Selected clean identities

All six uniform candidate names returned HTTP 404:

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

After all source-bound release gates pass, an authorized release operator must publish a unique `0.1.0-rc.N` set under `next`, install and verify the exact registry artifacts, publish stable `0.1.0` under `rewrite`, and verify the full set again. Only then may the allowlisted `scripts/release/deprecate-legacy.mjs --apply` operation mark the five exact 0.2.0 lineages as migrated. The operation requires the verified stable candidate manifest and compares every replacement registry integrity before touching legacy metadata. Dist-tag promotion and production deployment remain later, explicit operations.
