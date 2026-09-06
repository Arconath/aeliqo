---
name: aeliqo-contract-evolution
description: "Use when changing a public API, dataset/component/workspace schema, operation grammar, registry, migration, or renderer boundary. Not for purely visual token adjustments."
---

# Evolve portable Aeliqo contracts

## Scope

This skill is repository-local. Read applicable AGENTS instructions first; use this workflow only for the matching task. Do not install global skills/plugins or load every other Aeliqo skill.

## Read only what this task needs

- [03-architecture.md](../../../docs/aeliqo/03-architecture.md)
- [04-contracts-and-grammar.md](../../../docs/aeliqo/04-contracts-and-grammar.md)
- [06-component-contract-and-dx.md](../../../docs/aeliqo/06-component-contract-and-dx.md)
- [contracts/v0.1/README.md](../../../docs/aeliqo/contracts/v0.1/README.md)

## Workflow

Identify the existing source of truth and wire/package versions. Start with the user task and two unrelated domain examples. Keep developer authoring ergonomics separate from serialized safe specs; trusted callbacks stay in developer code. A simple primitive must not need the full workspace descriptor.

Write valid, invalid, old-version and unknown-capability examples before implementation. Choose additive registry extension versus core change based on repeated needs, not speculative universality. Define ownership, typed IDs, input/output semantics, lifecycle, resource limits and fallback. Preserve existing compatible APIs; candidate schemas from the kit are not automatically superior.

Update canonical schema, generated types/validators, tool-specific schema subset, documentation and fixtures in one change. Structural validation does not replace cross-reference, units, permissions or revision checks. Keep migrations pure and explicit. Avoid executable JS/SQL/HTML or arbitrary module URLs in agent payloads. Prove a custom registered component can use the same path without a special branch in core.

## Completion evidence

Schema/type/semantic tests; compatibility fixtures; progressive API example; import-boundary check; documented migration or a justified no-break conclusion.

Report checks actually executed and their results. A schema, plan, screenshot, or mocked adapter proves only its own scope. Preserve user changes and record concrete blockers without inventing completion.
