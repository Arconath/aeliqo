# Aeliqo technical guides

The public website at [docs.aeliqo.com](https://docs.aeliqo.com/) is the primary adoption guide and generated component reference. The files here explain implementation details for contributors and teams integrating advanced Aeliqo boundaries.

## Start integrating

- [Framework integration](framework-integration.md): vanilla JavaScript, React, Vue, SSR, hydration, and package boundaries.
- [Meaning authoring](meaning-authoring.md): define, register, review, and activate versioned business meaning.
- [Presentation adaptation](presentation-adaptation.md): bind Results to responsive presentations without changing their claim.
- [Migration to 0.1.0](migration-0.1.0.md): move from historical package lines to the current API.
- [Support boundary](public/0.1.0-support-boundary.md): supported runtimes, browsers, and package compatibility.

## Components and composition

- [Foundation components](foundation/README.md)
- [Inputs and semantic fields](input/README.md)
- [Navigation](navigation/index.md)
- [Feedback](feedback/index.md)
- [Data components](data-components/README.md)
- [Plots](plot/README.md)
- [Visualization](visualization/README.md)
- [Semantic compounds](compounds.md)
- [Compound validation](compound-semantic-validation.md)
- [Navigation and feedback regions](navigation-feedback-region.md)

## Runtime and tools

- [Agent protocol overview](agent-protocols/compatibility.md)
- [MCP integration](agent-protocols/mcp.md)
- [Bring your own model](agent-protocols/byok.md)
- [WebMCP boundary](agent-protocols/webmcp.md)
- [Local Studio](studio.md)
- [Basic monitoring](basic-monitoring.md)

Agent documentation describes the optional `@aeliqo/agent` product package. It is unrelated to repository automation or contributor tooling.

## Architecture decisions

The [ADR directory](adr/) records stable choices such as the four public contracts, one data-service boundary, the shared web implementation, task-preserving presentations, and replayable presentation plans.

## Public documentation source

Authored website pages live in [`public-site/content.mjs`](public-site/content.mjs). Component reference pages are generated from the built package declarations, the public component catalog, and executable examples. Release artifacts are generated under the ignored `artifacts/public-docs` directory and must not be committed.
