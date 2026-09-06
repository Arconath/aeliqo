---
name: aeliqo-agent-integration
description: "Use for MCP, browser-session pairing, tool descriptions, workspace-vs-chat routing, optional BYOK or experimental WebMCP. Not for unrelated repository code editing."
---

# Integrate agent tools and UI outcomes

## Scope

This skill is repository-local. Read applicable AGENTS instructions first; use this workflow only for the matching task. Do not install global skills/plugins or load every other Aeliqo skill.

## Read only what this task needs

- [11-runtime-transactions.md](../../../docs/aeliqo/11-runtime-transactions.md)
- [12-agent-routing-mcp-webmcp.md](../../../docs/aeliqo/12-agent-routing-mcp-webmcp.md)
- [16-test-strategy.md](../../../docs/aeliqo/16-test-strategy.md)
- [22-packaging-release-security.md](../../../docs/aeliqo/22-packaging-release-security.md)

## Workflow

Check the actual host/client/protocol capabilities and versions. Repository AGENTS controls development behavior; it does not automatically instruct every end-user harness. Distinguish source-edit tasks, explanation-only requests and active-workspace intents. Expose a small useful tool catalog with concise descriptions, compact server instructions and explicit paired workspace context.

Route all adapters to the same dispatcher. A tool that fetches data does not itself fulfill a requested chart/filter/layout change. A query result in chat is not a substitute for an explicit UI request, while a chat-only explanation must not mutate UI. Validate target, permission, schema, semantic meaning and revision. Keep read-only and side-effect tools separate.

Pair the authorized browser instance deliberately; MCP alone does not own its DOM. Return compact receipts with request/revision and separate operation/render/data status. Never report completed just because a message was queued. Keep WebMCP optional and feature-detected, and BYOK credentials outside browser bundles.

Run real-harness outcome evals with model/client/config/trials recorded. Mock tests prove adapter contracts only. Measure false mutations, false completion and missed tool use; do not hide failures behind long forced prompts that users must repeat.

## Completion evidence

Adapter conformance; paired workspace/authorization tests; routing cases and real-host evidence where available; honest unsupported/disconnected states; no raw secrets or mandatory cloud.

Report checks actually executed and their results. A schema, plan, screenshot, or mocked adapter proves only its own scope. Preserve user changes and record concrete blockers without inventing completion.
