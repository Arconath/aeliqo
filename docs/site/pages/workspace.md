---
id: 'workspace'
path: '/guides/workspace/'
section: 'Build'
title: 'Workspace composition'
description: 'Compose registered needs into one bounded presentation without changing scope or duplicating child owners.'
---

<p class="lead">A workspace joins several authorized Results under one presentation plan. The application registers the goal, child representations, pattern, and state mappings; an agent cannot invent a component tree or a new capability.</p>

## Start with a registered goal

A registered custom intent may compile to one Task with multiple required needs. Each need names an allowed operation and a Result output. The synthetic attendance overview has three needs: a summary, a daily trend, and an employee breakdown. It uses only registered data and meanings. It does not claim anomaly detection or explain why attendance changed. See [intent contracts](/concepts/intent/) and [analytics](/guides/analytics/).

The runtime evaluates the needs through the usual authority and Result path. A trusted presentation pattern can expand the matching Task and exact Results into a bounded plan with a workspace root and three child nodes. The plan must cover the required needs and pass the same validation as a single view before a Region commits it. Unknown outputs, incompatible child representations, and missing mandatory Results fail explicitly.

Use this pattern when one registered goal genuinely needs several simultaneous
outputs. If a person is only browsing one result, keep one ordinary surface.
Register each child representation and its result binding in application code;
the goal names required outputs, not arbitrary components supplied by a model.
The host registers allowed patterns. When an experience requires a registered
pattern, the resolver can discover a matching one from that registry even if
the candidate list is empty; a supplied candidate still passes the same
validation.

## Keep child identity and state

Single, split, and compare layouts remain inside the active application scope. A layout change must not create a second data or action owner for a child. Stable child addresses and registered state mappings preserve eligible selection, filter, focus, and draft state across transitions. A dirty interaction can defer an adaptive layout change. Resize alone does not authorize new data or a model call. See [application scopes](/guides/scopes/) and [state ownership](/concepts/state-ownership/).

## Commit and recover

The host supplies candidate plans and the runtime validates their captured task, Result, permission, policy, scope, and child revisions before commit. A mandatory child failure or cancellation keeps the previous authorized layout; showing a partial layout requires an explicit policy. Forced revocation clears the old subtree immediately. Cross-scope children, cyclic links, duplicate owners, excessive depth or fan-out, and stale acknowledgements are rejected.

`renderer-ready` means the validated plan and renderer handoff completed; it is not proof of simultaneous browser paint or user attention. An app owns any database undo or business compensation separately.

## Current evidence

From the repository root, run `pnpm test:vnext:browser` after installing the
workspace dependencies. The 0.5 source's
`examples/vnext/workspace-goal` fixture compiles one registered attendance goal
to a Task with three required needs, evaluates three Results, offers a
empty candidate list to the resolver, which discovers its registered bounded
pattern, commits the selected plan, and
renders summary, trend, and breakdown in one Region. Its browser test checks
exact need/output/Result identities and retains the authorized old layout
after an unknown goal or mandatory breakdown failure.

Run **Analytical workspace** in the [public Playground](/playground/) to inspect the registered pattern and three committed outputs. The separate `examples/vnext/workspace` fixture checks child focus and reflow
at 360, 768, and 1440 pixels. These fixtures use synthetic data and are not a
live model or customer rollout. See [runnable examples](/examples/) for their
boundaries.
