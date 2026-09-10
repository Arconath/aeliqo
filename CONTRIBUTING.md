# Contributing

Read AGENTS.md and docs/README.md. Follow the task DAG, change one owned subsystem at a time, and include focused tests, public examples, and error semantics in each atomic commit. Preserve the boundaries in MASTER-SOT.md; a passing type check does not prove business meaning, authorization, accessibility, or model correctness.

Use the pinned Node and pnpm versions from `package.json`. Run the focused package command for your change, then broaden to `pnpm check` in proportion to risk. Do not bypass a product or release gate, weaken a required scenario, or substitute specification validation for product evidence.

Contract changes require ADR/migration review. UI changes require inspected visual differences and keyboard/focus tests. Security/a11y/semantic correctness are constraints, not polish. Do not add vendor-specific branches to core or copy renderer logic into framework wrappers.

## Inbound license and sign-off

Contributions are accepted under Apache-2.0, the same license as the public repository, unless the maintainers explicitly agree to a different arrangement before submission. No separate contributor license agreement is required by this policy.

Every commit contributed for inclusion must carry a `Signed-off-by: Name <email>` trailer. By adding that trailer, the contributor certifies the [Developer Certificate of Origin 1.1](https://developercertificate.org/) for that commit. Use `git commit --signoff`; maintainers may ask for a corrected sign-off before merging. Sign-off records authorship and permission to contribute—it does not grant maintainership, release authority, or permission to include third-party material.

Do not submit proprietary customer data, API keys, third-party assets without rights, or fabricated execution evidence. See [TRADEMARKS.md](TRADEMARKS.md) for project-name and logo use. Repository owners decide maintainership and release permissions; this file grants none.
