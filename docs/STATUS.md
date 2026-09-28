# Aeliqo status

Last updated: 2026-09-28. This is the single maintained status record. Release
history lives in the [release notes](site/pages/release-notes.md) and on
[GitHub releases](https://github.com/Arconath/aeliqo/releases).

## Goal

Aeliqo is an Apache-2.0 framework that turns a validated intent into a
registered view. The same path works from application code or an optional
agent (MCP, WebMCP, or a bring-your-own-key model). The host application owns
data, permissions, routes, and business effects. Aeliqo needs no account,
hosted backend, license server, or model call.

## Published

| Surface  | Current                                                                                                                                                                           |
| -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| npm      | `@aeliqo/core`, `runtime`, `web`, `react`, `agent` at `0.6.1` (`latest`), from source `fec91ad5`                                                                                  |
| Site     | aeliqo.com, www, and docs.aeliqo.com serve source `7fa5a0ba` with SDK `0.6.1`                                                                                                     |
| Image    | `ghcr.io/arconath/aeliqo-web@sha256:4b0779ee9b21706068e265e27de38a3c95ed4fa3c9a9807b2a2ae4667b448f25`                                                                             |
| Delivery | Promoted by platform-apps commit `60f8c44f`; health, readiness, and exact version accepted in `25422813` on 2026-09-28. Rollback: revert the promotion commit (application only). |

## Progress against the goal

- **Done:** intent-to-view for components, workspaces, and registered pages;
  71 documented components; React, Vue, Vanilla, and Next SSR consumers; agent
  tools that accept a minimal intent and return ready-to-send examples; a
  standalone local MCP/BYOK example; a public playground with manual controls
  and native WebMCP.
- **Partly done:** agent diagnostics name the rejected field but often not the
  valid values, so a model may not recover after one mistake.
- **Not proven:** no measured success rate with a real model on the 0.6 tools,
  no external adopters yet, and WebMCP still needs an experimental browser
  flag.

## Open items

| Item                                                                                                                                          | Next step                                                                                 |
| --------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `measures: ["hires"]` (strings instead of objects) is reported as an undeclared measure.                                                      | Report the expected `{ "id": … }` shape.                                                  |
| Diagnostics for an unknown grain, field, view, filter value, or missing measure do not list the valid values; one shows a raw schema message. | List the allowed values in each diagnostic.                                               |
| The render tool describes success as `renderer-ready`; hosts without a render port return `plan-committed`.                                   | Describe both success states.                                                             |
| Container visual comparison has no approved baseline, so it always fails.                                                                     | Approve a reviewed baseline, or remove the job.                                           |
| Paired performance reports a changed workload hash after 0.6.1.                                                                               | Review the workload and record a new reference in `docs/testing/`.                        |
| Production promotion is a manual GitHub API commit; `promote.yml` in platform-apps does not list Aeliqo.                                      | Add Aeliqo to the platform promote workflow.                                              |
| No evidence of value against a plain "model tool + own component" integration.                                                                | Build one use case both ways and compare code size, safety, and behavior on model errors. |

Visual and performance jobs are advisory; the functional matrix in
`quality/commands.json` is the required gate.
