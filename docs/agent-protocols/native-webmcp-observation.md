# Native WebMCP observation

This record is a browser observation of the native WebMCP surface. It does
not use the Aeliqo adapter's simulated `modelContext`, a browser automation
shim, an external model, or an API credential. The page only registers one
local tool, invokes it through the browser's `executeTool` method, and removes
it with the registration `AbortSignal`.

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
  node tests/protocol-webmcp/native-probe.mjs
```

The probe serves `http://127.0.0.1` (a secure browser context), launches the
Playwright-bundled Chrome for Testing with a new temporary profile for each
mode, and records the browser version, flags, page origin, secure-context
status, registration, invocation, and disposal observations. Headed mode is
intentional because this is a native browser observation rather than a
headless or simulated adapter test.

## Observation on 9 September 2026

The bundled browser was Chrome for Testing `153.0.8010.12`, launched with
Node `v24.20.0` and pnpm `11.24.0`. The probe was measured at
`2026-09-08T20:36:14.587Z` (`2026-09-09` in the project timezone), from the
fresh worktree at `7184cd4`. Both runs used headed mode and a fresh temporary
profile; no existing browser session was reused. The executable was:

`/Users/nino/Library/Caches/ms-playwright/chromium-1243/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing`

The result below preserves the exact observed facts while omitting the
ephemeral port and temporary profile names:

```json
{
  "browser": "Chrome for Testing 153.0.8010.12",
  "origin": "http://127.0.0.1:<port>/",
  "default": {
    "flags": [],
    "secureContext": true,
    "modelContextPresent": false,
    "status": "blocked"
  },
  "enable-webmcp-testing": {
    "flags": ["--enable-features=WebMCPTesting"],
    "secureContext": true,
    "modelContextPresent": true,
    "registered": true,
    "invoked": true,
    "disposed": true,
    "events": [{
      "phase": "execute",
      "input": "probe",
      "signalPresent": true,
      "signalAborted": false
    }],
    "toolsBeforeDispose": [{
      "name": "aeliqo_native_probe",
      "annotations": {
        "readOnlyHint": true,
        "untrustedContentHint": false
      }
    }],
    "invokeResult": "aeliqo-native:probe",
    "toolsAfterDispose": [],
    "pageErrors": [],
    "status": "pass"
  }
}
```

The flagged run is the native proof: the browser exposed
`document.modelContext`, registered `aeliqo_native_probe`, returned
`aeliqo-native:probe` from the browser's own `executeTool` call, and removed
the tool after `AbortController.abort()` (`getTools()` no longer listed it).
The tool did not contact a model, network service, or Aeliqo endpoint.

The default run remains a useful control and is `BLOCKED` for native support;
it does not count as a failure of the adapter contract. This observation is
limited to Chrome for Testing 153.0.8010.12 on the recorded machine and date;
it does not establish support in other browser channels or versions.
