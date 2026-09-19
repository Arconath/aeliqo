# Contributing to Aeliqo

Thanks for helping improve Aeliqo. Read [AGENTS.md](AGENTS.md) for the repository map, code and documentation conventions, testing matrix, and release process before opening a pull request.

Keep a contribution focused, include tests for behavior that can regress, and update the relevant documentation when a public API changes. Do not include secrets, customer records, generated build output, or local tool configuration.

## Local setup

Use the Node.js and pnpm versions declared by the repository. Install dependencies
from the root, then run the focused package or site command for the area you are
changing. `quality/commands.json` is the complete acceptance matrix.

For the optional local Playground model connection, copy
`apps/site/.env.example` to `apps/site/.env.local` and replace only the local
copy. Never put a provider key in an issue, test fixture, screenshot, URL, or
committed file. Browser BYOK uses the user's key in page memory and does not use
this file.

## Pull requests

Explain the changed behavior, include fresh verification output, and keep public
documentation in the same change as the code. Public API changes also require
the matching package guide, export map, clean tarball consumer, and release
note. UI changes should cover the applicable loading, empty, error, disabled,
focus, long-content, responsive, reduced-motion, and right-to-left states.

Run `pnpm check` from a clean commit before a release candidate. Routine pull
requests may use the smallest commands that exercise the changed contract; the
required GitHub checks still run before merge.

## Commit sign-off

Every contributed commit must include a `Signed-off-by: Name <email>` trailer under the [Developer Certificate of Origin 1.1](https://developercertificate.org/). Create it with:

```sh
git commit --signoff
```

Contributions are accepted under Apache License 2.0 unless the maintainers agree to different terms before submission. Do not submit third-party material without the right to redistribute it.

## Reporting security issues

Do not open a public issue for a vulnerability. Follow [SECURITY.md](SECURITY.md) and use GitHub private vulnerability reporting.
