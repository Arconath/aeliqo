# Aeliqo site assembly

This application builds the Aeliqo website, documentation, component reference, and playground into one static artifact.

The assembly builds the site, documentation, and playground from the packages and authored content in this monorepo. Release workflows create immutable package, documentation, and image artifacts only after an exact source commit exists, keeping generated binaries out of the source tree.

Use Node.js `24.20.0` and pnpm `11.24.0`:

```sh
pnpm install --frozen-lockfile
pnpm check
```

`pnpm build` writes the static site to `dist`. The small Go server supplies static delivery plus `/healthz`, `/readyz`, and `/version`; the version endpoint reports the site and packaged SDK source identities separately.

The site has no production credentials and does not deploy application code. Image publication and production promotion remain separate release operations.
