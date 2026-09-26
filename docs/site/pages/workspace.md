---
id: 'workspace'
path: '/guides/workspace/'
section: 'Guides'
title: 'Workspace composition'
description: 'Compose registered needs into one bounded presentation without changing scope or duplicating child owners.'
---

<p class="lead">A workspace joins several authorized results under one presentation plan. Your app registers the goal, the child views, the pattern, and the state mappings. An agent cannot invent a component tree.</p>

## When you need this

- One registered goal genuinely needs several simultaneous outputs — a summary, a trend, and a breakdown.
- You want one committed layout instead of coordinating separate surfaces yourself.
- You must keep each child's state and owner stable while the layout adapts.

If a request only browses one result, keep one ordinary surface.

## 1. Register a goal with several needs

A registered custom request may compile to one task with multiple required needs. Each need names an allowed operation and a result output. An attendance overview, for example, can require a summary, a daily trend, and a per-person breakdown. All come from registered data and meanings. It does not claim anomaly detection or explain why attendance changed. See [request contracts](/concepts/intent/) and [analytics](/guides/analytics/).

## 2. Let the runtime evaluate the needs

The runtime evaluates each need through the usual authority and result path. A trusted presentation pattern then expands the matching task and its exact results into a limited plan. The plan has a workspace root and one child node per need.

The plan must cover the required needs and pass the same validation as a single view before a region commits it. Unknown outputs, incompatible child views, and missing mandatory results fail explicitly.

## 3. Resolve a registered pattern

The host registers the allowed patterns. When a composition requires a registered pattern, the resolver can discover a matching one from that registry. That holds even if the candidate list is empty. A supplied candidate still passes the same validation.

## 4. Keep child identity and state

Single, split, and compare layouts stay inside the active scope. A layout change must not create a second data or action owner for a child. Stable child addresses and registered state mappings preserve eligible selection, filter, focus, and draft state across transitions. A dirty interaction can defer an adaptive layout change. Resize alone never authorizes new data or a model call. See [application scopes](/guides/scopes/) and [state ownership](/concepts/state-ownership/).

## 5. Commit and recover

The host supplies candidate plans; the runtime validates their captured task, result, permission, policy, scope, and child revisions before commit. A mandatory child failure or cancellation keeps the previous authorized layout — showing a partial layout takes an explicit policy. Forced revocation clears the old subtree at once.

`renderer-ready` means the validated plan and renderer handoff completed. It is not proof of simultaneous browser paint or user attention. Your app still owns any database undo or business compensation.

## What can go wrong

- A cross-scope child, a cycle, a duplicate owner, or depth and fan-out beyond the limits is rejected. So is a stale acknowledgement.
- An unknown goal or a failed mandatory child keeps the authorized old layout — no blank hybrid appears.
- A workspace selector is a candidate, not permission. Scope rules still apply.

<nav class="doc-next" aria-label="Continue reading"><p>Next</p><a href="/examples/"><span>Runnable examples</span><small>See registered compositions in working apps.</small><b aria-hidden="true">→</b></a><a href="/guides/scopes/"><span>Application scopes</span><small>Understand the tenancy boundary layouts must respect.</small><b aria-hidden="true">→</b></a></nav>
