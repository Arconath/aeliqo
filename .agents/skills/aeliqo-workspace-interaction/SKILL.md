---
name: aeliqo-workspace-interaction
description: "Use for composition, layout switching, pinning, linked filters/selections, focus/drafts, undo, persistence or human-agent concurrency."
---

# Maintain adaptive workspace integrity

## Scope

This skill is repository-local. Read applicable AGENTS instructions first; use this workflow only for the matching task. Do not install global skills/plugins or load every other Aeliqo skill.

## Read only what this task needs

- [02-smartness-model.md](../../../docs/aeliqo/02-smartness-model.md)
- [09-workspace-and-layout.md](../../../docs/aeliqo/09-workspace-and-layout.md)
- [10-interactions-and-actions.md](../../../docs/aeliqo/10-interactions-and-actions.md)
- [11-runtime-transactions.md](../../../docs/aeliqo/11-runtime-transactions.md)

## Workflow

Classify the change as presentation, query semantics, selection/highlight or business action. Use the shared validated operation path for durable workspace changes. Keep hover, drag feedback and other high-frequency ephemeral state local. Do not add network/LLM calls to pointer movement or ordinary controls.

Specify revision preconditions, user pin precedence, stable node ownership and focused input preservation. Prepare resources before commit, recheck after async work, and bound retries/history. Do not assume a React key preserves local state across different parents. Keep DOM reading order meaningful during adaptive layout changes.

For links, validate typed ports and explicit entity relations; distinguish highlighting from filtering. Prevent feedback loops and stale query results. Undo applies only to reversible UI state, not an already executed business mutation. Test resize during IME editing, concurrent agent edits, disconnect/reconnect, removed nodes, and storage failures. Return separate operation/render/data status rather than a premature success string.

## Completion evidence

State-machine/concurrency tests; pin/focus/draft persistence; linked-event scope checks; bounded cleanup; truthful receipt and browser projection evidence.

Report checks actually executed and their results. A schema, plan, screenshot, or mocked adapter proves only its own scope. Preserve user changes and record concrete blockers without inventing completion.
