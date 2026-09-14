# Contributing to Aeliqo

Thank you for helping improve Aeliqo. Contributions should keep the framework usable through direct components, preserve application ownership of data and business actions, and avoid duplicating behavior across framework wrappers.

## Set up the workspace

Use Node.js `24.20.0` and pnpm `11.24.0`.

```sh
corepack enable
corepack prepare pnpm@11.24.0 --activate
pnpm install --frozen-lockfile
```

Create a focused branch and keep unrelated cleanup out of the same pull request.

## Make a change

- Add or update tests for behavior that can regress.
- Keep public package versions aligned.
- Use narrow package entry points in examples.
- Preserve keyboard, focus, reflow, forced-colors, and screen-reader behavior for UI changes.
- Keep identity and authorization in the integrating application; proposals and browser payloads do not grant authority.
- Document public API changes and add migration guidance when compatibility changes.
- Do not include secrets, customer data, generated build output, or local tool configuration.

Run the smallest relevant checks while developing. Before opening a substantial pull request, run the full source quality suite:

```sh
pnpm typecheck
pnpm lint
pnpm check
```

Website, documentation, or playground changes also require:

```sh
pnpm test:docs-artifact
pnpm site:test
```

Inspect changed interfaces at desktop and narrow widths in both light and dark themes. Automated accessibility checks support this review but do not replace keyboard and assistive-technology judgment.

## Commit sign-off

Every contributed commit must include a `Signed-off-by: Name <email>` trailer under the [Developer Certificate of Origin 1.1](https://developercertificate.org/). Create it with:

```sh
git commit --signoff
```

Contributions are accepted under Apache License 2.0 unless the maintainers agree to different terms before submission. Do not submit third-party material without the right to redistribute it.

## Reporting security issues

Do not open a public issue for a vulnerability. Follow [SECURITY.md](SECURITY.md) and use GitHub private vulnerability reporting.
