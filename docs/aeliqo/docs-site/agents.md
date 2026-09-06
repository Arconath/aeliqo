# Connect an agent to a workspace

Suggested opening: Your agent chooses tools; Aeliqo validates and applies supported changes to a specifically connected workspace. You speak about the outcome, not the transport, but the connection and tool-selection behavior still need to be configured and tested.

## Choose a supported path

MCP: configure the tested server/companion and pair the authorized browser workspace. The page must be integrated with Aeliqo; MCP does not automatically own its DOM. BYOK: an optional backend/local provider integration uses the same capabilities, with keys outside the browser bundle. WebMCP: an experimental site adapter depends on actual browser/host support; no universal compatibility claim.

Show exact config only after the executable/package and protocol version exist. Project-local Codex configuration is different from global configuration; explain scope. Repository AGENTS and developer skills guide implementation, not every external user's agent conversation.

## Connection UI

Show workspace name, connection status, active instance, permissions and supported operations. Keep pairing explicit where more than one target exists. Let users disconnect and cancel without losing their current manual interface. A disconnected renderer returns a visible limitation, never an “updated” success toast.

## Outcome example

“Show a comparison of the selected models.” The agent may inspect the workspace/catalog, query permitted data and apply a compatible view. Completion requires the requested operation, current render acknowledgement and required data readiness. Fetching rows alone is not completion. An explicit “explain in chat only” request must not modify the workspace.

## Troubleshooting

No tools visible: inspect actual server connection/trust/permissions and host compatibility. Data appears only in chat: inspect tool descriptions, workspace context and the UI completion contract; run the corresponding routing eval. Correct commit but stale UI: correlate request/workspace/render revisions and browser connection. Never fix it by telling every user to repeat “use MCP” in every prompt.
