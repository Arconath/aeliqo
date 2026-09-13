# Aeliqo website

This directory owns the presentation and delivery shell for `aeliqo.com` inside
the public [Arconath/aeliqo](https://github.com/Arconath/aeliqo) repository. The
framework, developer documentation source, API metadata producer, runnable
examples, Studio, testkit, docs and playground now share one repository.

The site does not read a sibling SDK checkout. It installs six source-bound
`0.1.0-rc.2` candidate tarballs from `vendor/packages` and consumes the public
documentation/example artifact in `vendor/public-docs`. `pnpm verify:inputs`
checks every candidate and documentation checksum, exact version, source SHA,
and path before a build starts.

## Local verification

Use Node 24.20.0 and pnpm 11.24.0.

```sh
corepack enable
corepack prepare pnpm@11.24.0 --activate
pnpm install --frozen-lockfile
pnpm exec playwright install chromium
pnpm check
```

`pnpm build` creates all 96 static routes in `dist`. The Go server provides
static delivery plus `/healthz`, `/readyz`, and `/version`; `/version` reports
the site source and SDK source/version separately.

Package publication, site image publication, GitOps promotion, and live cutover
are distinct effects. Pull-request and main quality run on GitHub-hosted runners
with read-only source permissions. Performance qualification remains deferred
by the owner and is excluded from the required site check; its tests and budgets
remain as historical/optional evidence. An owner dispatch may publish only the
exact successful main SHA. CI has no production credentials: a reviewed
Aeliqo-only GitOps change remains the sole promotion path.
