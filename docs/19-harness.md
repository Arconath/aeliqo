# 19 — Agent harness: Astra Medium + Luna Max

## Requested policy

Main orchestrator: **Astra Medium**. Workers and independent reviewers: **Luna Max**, using the maximum useful available parallelism. This is the user's explicit selection. The harness must inspect the installed local runtime's actual model IDs, supported effort values, configuration schema and spawn capacity; it does not silently replace Max with xhigh or guess an Astra ID.

Official documentation confirms subagent model/effort controls and shows Luna model examples. The retrieved subagent page mentions max/xhigh while a config reference still lists an older effort set. Treat this as a verification requirement, not a reason to invent a config key. Record effective settings from the actual session. [S21, S22, S23]

## What is included

`harness/runtime-request.json` records the desired model policy. `scripts/configure_agents.py` accepts a **locally verified capability file** and produces project-local config/role files; it does not call models or prove those settings are active. `harness/runtime-capabilities.example.json` documents the required evidence shape and deliberately contains no invented model IDs. The example cannot be used as live evidence.

The orchestrator can alternatively configure roles through the actual desktop/session UI and record the resulting effective values. Do not edit global ~/.codex config, provider-managed plugins, or existing global skills without explicit ownership and necessity. Project trust is required for local config to apply. A child cannot gain broader sandbox/network/release rights than its parent.

## Capacity and model verification

Read the local model catalog or supported model picker and installed configuration documentation. Find Astra and Luna by actual available entries. Confirm Medium/Max are supported by those entries. Capture runtime version, model IDs, effort choices, supported agent config style and observed maximum concurrent threads. Perform a minimal real spawn test and record effective child model/effort. Do not label a generated TOML or prompt as a completed model switch.

If requested settings are not available, mark runtime setup blocked and proceed with read-only/planning/other work that does not pretend to satisfy that setup. Do not ask the owner to repeat requirements or silently use a cheaper/different model. A future explicit owner decision can approve a fallback.

## Parallel scheduling

Effective concurrency = min(runtime limit, number of ready independent tasks, local resource budget). Use all effective capacity for useful work, not an arbitrary huge thread count. No recursive subagent spawning. End idle agents so capacity can be reused. Browser/benchmark jobs may require lower CPU concurrency to produce trustworthy measurements; that is not reducing reasoning effort.

The main agent owns contract decisions, integration, task graph, lockfile and releases. Workers have disjoint path ownership and a task ID. Use one Git worktree per writer. Do not let two agents edit the same contracts/root configuration. Independent reviewer roles are read-only and do not approve their own authored changes.

## Task packet

Each spawned task receives: goal, acceptance criteria, dependency commit/contracts, owned paths, prohibited paths, relevant docs, test commands, expected evidence and stop conditions. Return a concise summary with commit/diff, tests, failures, assumptions and follow-up—not the entire scratchpad or every log line.

Suggested roles: contract/semantics, query/data-host, runtime/concurrency, web primitives, 2D geometry, interaction/a11y, React/SSR/consumer, agent transport, Studio/docs, quality/security and release. These are scheduling roles, not ten permanently resident agents. Spawn only when their task dependencies are satisfied.

## Development loop

Select ready task -> write/check acceptance -> implement real behavior -> focused test -> independent review -> repair -> record evidence -> atomic commit -> integrate -> rerun impacted gates -> checkpoint -> continue.

At a blocker, finish independent available work and document the precise missing system/credential/review. Do not end after scaffold or ask for permission to do ordinary steps already authorized by the main prompt. Do not invent successful background work after the session ends.

## Context discipline

AGENTS.md is a short index/constitution; domain docs hold detail. Read relevant files progressively. Keep checkpoint and task state in the repo. Source authoritative behavior from current code/specs, not old chats. Record source/evidence links when architecture assumptions are checked. This follows the repository-as-system-of-record and mechanically enforced boundary pattern described in OpenAI's harness guidance. [S24]

## Local skills only

The included skills are narrow Aeliqo workflows. They do not duplicate generic provider skills or install 20 global instructions. Inspect effective precedence and existing v3.2 plugin/standalone skill overlap; preserve their ownership mechanisms. Native AGENTS discovery behavior is documented by OpenAI and should be verified against the installed client. [S25]

## Checkpoints and honesty

Record current SHA, task statuses, passed commands, blocked gates, relevant decisions and exact next commands. A checkpoint is not evidence that tests passed. A status flag needs artifact evidence. At session interruption, the resume prompt reconciles Git/task/evidence state; it does not restart from an empty folder.

Do not claim subagents were run during preparation of this kit: this conversation did not expose a subagent execution tool. The harness configures and directs the user's later implementation runtime.


## Ready-task selection

`python3 scripts/next_tasks.py --limit 4` is a read-only helper. Replace 4 with actual currently available slots, already bounded by runtime/resources. It checks the DAG and avoids overlapping active/review/selected paths. The orchestrator still checks semantic coupling and acquires worktree ownership; the script does not spawn agents or claim model settings.

## Master consolidation task routing and evidence

Read only AGENTS + active task packet + related canonical chapters; do not paste the compiled blueprint into every worker. AI workers may propose architecture changes, but contracts/lockfile/migrations require orchestrator review before other workers adopt them. No worker approves its own evidence.

Use the owner-requested Astra Medium and Luna Max as a policy to verify on the actual local model picker/runtime. Current public docs mention model/effort controls but do not establish this user's effective ID or session setting. No silent substitutions, hardcoded guessed IDs, repeated unsupported spawn loops or global config overwrite. If a requested setting is unavailable, record that precise blocker and complete unaffected tasks.

Master consolidation adds T39 (early actual vertical path) and T40 (real smartness/claim evaluation). It fixes ownership to src paths. `scripts/check_ownership.py` verifies changed paths against task ownership without granting release or sandbox permissions. A ready-task suggestion does not itself acquire a lock or start a child.

The developer harness and Aeliqo runtime agent loop are distinct: implementation subagents build the product; future product MCP/BYOK/WebMCP agents use it. Tests for one cannot be used as evidence for the other.
