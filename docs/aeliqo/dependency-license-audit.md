# Dependency license audit — local candidate

Checked on 7 September 2026 with the locked workspace installation.

`pnpm licenses list --prod --json` reported 105 production dependency entries: 85 MIT, 17 ISC, two BSD-3-Clause, and one BSD-2-Clause. No copyleft license appeared in the production dependency graph. The full development graph additionally contains test/build-only MPL-2.0 (`axe-core`), Python-2.0 (`argparse`), and CC-BY-4.0 (`caniuse-lite`) entries.

The direct third-party runtime packages used by the five-package allowlist are `zod` 3.25.76 (MIT), `zod-to-json-schema` 3.25.2 (ISC), `d3-scale` 4.0.2 (ISC), `d3-shape` 3.2.0 (ISC), `@modelcontextprotocol/sdk` 1.30.0 (MIT), and `ws` 8.21.3 (MIT). They remain separate npm dependencies rather than copied or bundled source. The wider production graph contains two BSD-3-Clause packages and one BSD-2-Clause package transitively; their own npm distributions retain their license files.

The owner selected Apache-2.0 for Aeliqo on 7 September 2026. Root `LICENSE` and `NOTICE` files are included in every generated tarball. A scan of the 72 source/runtime TypeScript, JavaScript, and CSS files under the repository implementation paths found no embedded third-party copyright or license header requiring transfer into the Aeliqo NOTICE. Git history available locally has one author identity, Hermawan Nino; this does not prove ownership of material created outside Git history or settle employer/contractor rights.

This is an engineering inventory, not a legal conclusion. Repeat the locked inventory from the clean final candidate, retain dependency lock integrity, and resolve any ownership facts outside repository history before registry publication.
