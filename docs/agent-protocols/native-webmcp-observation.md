# Native WebMCP adapter observation

This record proves the Aeliqo WebMCP adapter against Chrome's native
`document.modelContext` surface. The browser page imports the built
`@aeliqo/sdk-agent` WebMCP adapter, `AgentToolEndpoint`, capability registry and
`@aeliqo/sdk-core` wire validator. The endpoint uses the real capability
dispatcher with a local, read-only `catalog.read` handler. The page does not
inject a `modelContext`, install a shim, use browser automation as a protocol
substitute, contact a model, or send a provider request.

The official Chrome documentation describes `document.modelContext`,
`registerTool(tool, {signal})`, execution through `executeTool(tool, JSON)`,
and the `chrome://flags/#enable-webmcp-testing` local-development flag:

- [WebMCP overview](https://developer.chrome.com/docs/ai/webmcp)
- [Imperative API](https://developer.chrome.com/docs/ai/webmcp/imperative-api)

The imperative API page was last updated 1 September 2026 when this probe was
prepared. Chrome's overview page says the local flag is enabled in
`chrome://flags/#enable-webmcp-testing`; the probe passes its Chromium feature
name as `--enable-features=WebMCPTesting` to a fresh browser profile. No other
experimental feature flag is used.

Run from this worktree with the locked toolchain:

```sh
PATH=/Users/nino/.nvm/versions/node/v24.20.0/bin:$PATH \
  pnpm build:agent
PATH=/Users/nino/.nvm/versions/node/v24.20.0/bin:$PATH \
  node tests/protocol-webmcp/native-probe.mjs
```

The probe serves the page and built package modules from the current worktree
at `http://127.0.0.1` (loopback is a secure browser context), launches the
Playwright-bundled Chrome for Testing with a new temporary profile for each
mode, and records the browser version, flags, native detection, adapter
evidence, dispatcher receipt, native tool list and disposal result. Headed mode
is intentional because this is a native browser observation rather than a
headless or simulated adapter test.

## Observation on 9 September 2026

The bundled browser was Chrome for Testing `153.0.8010.12`, launched with
Node `v24.20.0` and pnpm `11.24.0`. The probe was measured at
`2026-09-08T20:44:25.060Z` (`2026-09-09` in the project timezone), from the
isolated T24 worktree at `60f6b77` plus the probe changes. Both runs used
headed mode and a fresh temporary profile; no existing browser session was
reused. The executable was:

`/Users/nino/Library/Caches/ms-playwright/chromium-1243/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing`

The result below preserves the observed facts while omitting the ephemeral
port and temporary profile names:

```json
{
  "browser": "Chrome for Testing 153.0.8010.12",
  "origin": "http://127.0.0.1:<port>/",
  "default": {
    "flags": [],
    "secureContext": true,
    "modelContextPresent": false,
    "adapterEvidence": "unavailable",
    "registrationCode": "agent.webmcp.unavailable",
    "status": "blocked"
  },
  "enable-webmcp-testing": {
    "flags": ["--enable-features=WebMCPTesting"],
    "secureContext": true,
    "modelContextPresent": true,
    "adapterEvidence": "native",
    "adapterSupported": true,
    "discoveryOk": true,
    "registered": true,
    "invoked": true,
    "dispatcherTransport": "webmcp",
    "dispatcherRegion": "region-1",
    "endpointInvocations": 1,
    "disposed": true,
    "lateDenied": true,
    "toolsBeforeDispose": [{
      "name": "aeliqo_native_adapter_probe",
      "annotations": {
        "readOnlyHint": true,
        "untrustedContentHint": true
      }
    }],
    "toolsAfterDispose": [],
    "pageErrors": [],
    "status": "pass"
  }
}
```

The flagged run is the native adapter proof: the browser exposed
`document.modelContext`; `detectWebMcp()` reported native evidence; the built
adapter discovered and registered the endpoint definition; Chrome's own
`getTools()` returned the registered tool; Chrome's `executeTool()` reached the
same paired `AgentToolEndpoint` and dispatcher and returned a `data-ready`
receipt with `transport: "webmcp"` and `targetRegionId: "region-1"`; and
`adapter.close()` removed the native tool after its registration signal was
aborted. A subsequent native execution was denied, and the endpoint handler
ran exactly once. The default run is deliberately `BLOCKED` because native
WebMCP is absent without the explicit testing flag; it is not a synthetic pass
or an adapter failure.

This observation is limited to Chrome for Testing 153.0.8010.12 on the
recorded machine and date. It does not establish support in other browser
channels or versions.
