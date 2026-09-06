# Architecture

## Principle

Agent reasoning decides WHAT should change.

The Aeliqo runtime determines HOW trusted components implement that change.

Rendering never depends on an LLM call.

## Dependency Model

                          Agent / User
                              |
              +---------------+---------------+
              |               |               |
             MCP            BYOK           WebMCP
                                             experimental
              |               |               |
              +---------------+---------------+
                              |
                    Capability Dispatcher
                              |
                    Workspace Operations
                              |
                    Headless Aeliqo Core
                     /                  \
                 DataPort            Workspace
                     \                  /
                      React Renderer
                            |
                    Smart Components
                            |
                     DOM / SVG / Canvas

## Core

`packages/core`

Framework-independent TypeScript.

Owns:

- DatasetContract;
- ComponentContract;
- CapabilityContract;
- Workspace model;
- WorkspaceOperation;
- revisions;
- semantic relationships;
- subscriptions;
- DataPort interfaces.

Core must not import:

- React;
- D3;
- MCP;
- provider SDKs;
- WebMCP;
- Node-only APIs.

## React

`packages/react`

Owns:

- React bindings;
- Level-1 Smart components;
- Level-2 Smart components;
- Workspace renderer;
- design tokens;
- responsive behavior;
- accessibility behavior;
- visualization rendering.

D3 may be used through modular packages.

## MCP

`packages/mcp`

Projects Capability Contracts as MCP tools.

Contains protocol-specific logic only.

Does not contain alternate Aeliqo logic.

## BYOK

`packages/byok`

Projects Capability Contracts as model tools.

Contains:

- ProviderAdapter;
- one real provider implementation for POC;
- deterministic test provider;
- tool-loop integration.

Provider secrets stay outside client bundles.

## WebMCP

`packages/webmcp-experimental`

Experimental.

Projects the same Capability Contracts as WebMCP tools.

Must be completely optional.

## Companion

`apps/companion`

Small Node process for POC connectivity.

Responsibilities may include:

- MCP server;
- browser/session connection;
- BYOK provider requests.

It is not a production backend.

## Playground

`apps/playground`

React application demonstrating:

- explicit components;
- compound components;
- Workspace;
- AI-landscape data;
- Proof Lab;
- protocol operations.

## DatasetContract

Minimum concepts:

- dataset id;
- entity id;
- stable key;
- field;
- semantic type;
- label;
- unit;
- aggregation;
- relationships.

Application data remains application-owned.

## ComponentContract

A Smart component declares:

- semantic purpose;
- accepted semantic inputs;
- semantic output/selection;
- supported interactions;
- layout constraints;
- adaptive capabilities.

## WorkspaceOperation

Small trusted mutation vocabulary:

- mount;
- remove;
- configure;
- connect;
- disconnect;
- select/focus.

Operations should support:

- revision checks;
- validation;
- idempotent request handling where relevant.

## CapabilityContract

Capabilities are protocol-independent.

Each capability defines:

- id;
- description;
- runtime input schema;
- execute function;
- typed result.

Adapters may translate schemas.

Adapters may not redefine execution semantics.

## Rendering

Workspace state contains semantic references.

It must not contain copies of large datasets.

The Showcase adds no parallel runtime. Its scenario layer translates semantic needs into catalog matches and the same versioned WorkspaceOperations used by direct, MCP, BYOK and experimental WebMCP control. Stable semantic node ids let compatible components survive scenario changes. A selection may fan out through several typed bindings; relationship bindings resolve foreign keys using declared dataset relationships.

Scatter uses `xMetric` plus `metric`; Distribution uses `metric`; Matrix uses declared metric `columns`; Relationship uses a declared `relationship`. These fields remain data references rather than rendering instructions. React components choose compact or rich variants locally from container size and data shape.

Components subscribe to the smallest useful state slice.

Selection subscriptions also observe application-owned snapshots along the current binding chain. Changes in a foreign key or a related target record notify only consumers whose resolved selection changes. Binding changes reconcile those subscriptions; removing the consumer releases them. Dataset updates do not increment presentation revision or copy records into workspace state.

Post-commit subscribers and telemetry are observational. Their exceptions are diagnosed and isolated so later observers still run and the caller receives the actual commit result. Apply results and successful apply events, including replay events, refer to the original commit revision rather than a later reentrant edit.

Core owns the version-0.2 presentation tracker shared by direct, MCP, BYOK and experimental WebMCP execution. A receipt reports committed operation, exact renderer acknowledgement, validated data readiness and overall outcome independently. Presented requires visible projection with ready affected data; a missing renderer, invalid snapshot, stale data, cancellation or disconnection cannot produce false completion. Bounded receipt recovery uses request identity through workspace_inspect. Observers cannot convert an already committed operation into a rejection.

Trusted component registries own extensible schemas and validations; agent configuration is bounded JSON. React registers corresponding renderers and fails presentation if one is missing or throws. Pins and undo/redo are human controls. All durable operations retain base-revision checks. Explicit same-dataset filter links remain distinct from selection links. Versioned persistence serializes presentation only into a new validated runtime; host data and storage effects remain application-owned.

Transient UI state remains local.

React remains owner of rendered DOM/SVG.

D3 is used for:

- scales;
- geometry;
- ticks;
- layouts;
- data visualization calculations.

## Responsive Design

Prefer:

- CSS Grid;
- Flexbox;
- CSS custom properties;
- container queries.

Component-level adaptive logic may change information density where CSS alone cannot express the desired behavior.

## Security Boundary

Agent requests are untrusted inputs.

They must be:

- schema validated;
- capability checked;
- Workspace validated;
- authorization-aware where application actions exist.

The POC should avoid destructive business actions.
