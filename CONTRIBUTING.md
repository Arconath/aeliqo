# Contributing to Aeliqo

Thank you for improving Aeliqo. Start with an issue for changes to public contracts, saved workspace data, security boundaries, or component semantics. Small fixes may go directly to a pull request.

## Development

Use Node.js 22.12 or newer and the pnpm version declared in `package.json`.

```sh
corepack pnpm install
pnpm check
pnpm check:packages
```

Keep application data outside Workspace state, validate untrusted inputs at runtime, and preserve the dependency direction documented in `docs/ARCHITECTURE.md`. New components need direct props, semantic binding, a registry manifest, validation, accessible interaction, package export, and a non-domain-specific example.

Pull requests should explain the user-visible behavior, contract compatibility, and verification performed. Do not include credentials, private datasets, or generated dependency directories. Contributions are licensed under Apache-2.0 when submitted.
