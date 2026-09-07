# Contributing

Read AGENTS.md and docs/README.md. The repository begins as a rewrite specification/harness; product tasks are explicitly planned. Follow the task DAG, change one owned subsystem at a time, and include focused tests, public examples and error semantics in each atomic commit. A small working vertical slice is preferable to hundreds of stubs, but all required release scope must eventually be completed.

Run the kit checks and harness unit tests now. Product CI is intentionally blocked until real commands, components and evidence exist. Once toolchain M0 is complete, use the generated pinned workspace scripts; never bypass them by changing a gate to unconditional success.

Contract changes require ADR/migration review. UI changes require inspected visual differences and keyboard/focus tests. Security/a11y/semantic correctness are constraints, not polish. Do not add vendor-specific branches to core or copy renderer logic into framework wrappers.

Contributions are under Apache-2.0 unless explicitly agreed otherwise. Do not submit proprietary customer data, API keys, third-party assets without rights, or fabricated execution evidence. Repository owners decide maintainership and release permissions; this file grants none.
