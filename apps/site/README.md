# Aeliqo public site

This is the static 0.1.0 rewrite site inside the owning product repository.
It uses the built Aeliqo packages and the existing locked Vite toolchain.
Deployment remains the repository's explicit release/GHCR/GitOps path.

The initial slice supplies a home page with a real manually filtered record
list, readable content routes, documentation navigation/search, and per-component
API declarations generated from `packages/web/dist`. The full catalog examples,
playground, release browser matrix, and installed-example proof are still in
progress. This slice is not T27 acceptance or a publication claim.

Run `pnpm build:platform` before `pnpm --filter @aeliqo/site dev` or `build`.
The Vite config generates route HTML from the maintained content and built
declarations. Generated routes and build output are not source files.

`public/aeliqo.png` is an unchanged copy of the workspace's canonical
`assets/logo/aeliqo.png`, copied into this product so builds do not reach into
the parent workspace. The same asset is used for the visible brand and favicon.
No invented brand artwork, visitor analytics, or provider credential is included.
