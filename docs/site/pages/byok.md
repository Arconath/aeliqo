---
id: 'byok'
path: '/agents/byok/'
section: 'AI agents'
title: 'Bring your own model'
description: 'Connect a provider through a trusted local host while keeping credentials outside the browser.'
---

BYOK connects your own provider account to Aeliqo's bounded tool loop. The
local runner keeps the key in its host process. The public playground has no
browser provider-key field and never calls a model directly.

## Set the model variables

1. Copy the example file:

   ```bash
   cp apps/site/.env.example apps/site/.env.local
   ```

2. Set every required value in `apps/site/.env.local`:

   ```dotenv
   AELIQO_MODEL_BASE_URL=https://your-provider.example/v1/
   AELIQO_MODEL=your-tool-capable-model
   AELIQO_MODEL_PROTOCOL=openai-compatible-chat
   AELIQO_MODEL_AUTH_SCHEME=bearer
   AELIQO_MODEL_API_KEY=your-local-secret
   AELIQO_MODEL_CAPABILITIES=tool-calls,usage,request-cancellation
   ```

   `AELIQO_MODEL_PROTOCOL` also accepts `openai-compatible-responses`; that
   profile requires HTTPS with bearer auth and no `request-retry` capability.
   `AELIQO_MODEL_AUTH_SCHEME` accepts `bearer`, `header`, or `none`. Choose
   `header` and set `AELIQO_MODEL_AUTH_HEADER` for a custom header. Choose
   `none` only for a local endpoint, and omit the key. Capabilities must
   include `tool-calls`.

3. For a loopback HTTP test endpoint, also set
   `AELIQO_ALLOW_INSECURE_MODEL_HTTP=1`. Remote model endpoints must use HTTPS.

## Start the runner and pair

1. From the repository root, run:

   ```bash
   pnpm playground:local
   ```

2. Open the printed address, `http://127.0.0.1:4174/playground/`. Use this
   local copy — the hosted site cannot pair with your runner because the
   browser blocks cross-site pairing.
3. Choose **Connect AI**, keep **Local Playground host**, and choose **Check
   connection**.
   You should see “Local runner connected — MCP endpoint and model are ready”.
   With an incomplete model configuration, the prompt stays disabled and the
   status tells you to configure a model in the local process.

## Send a prompt

Type a request and choose **Send to local agent**. The runner calls your
provider, turns replies into bounded tool calls, and the browser validates
each one against the paired Region. A proposal that fails validation commits
nothing. A `no-commit` reply appears as an agent draft, not a UI change.

The host sets a short-lived HttpOnly session cookie. The browser pairs its
current Region over a same-origin event stream, and your prompt goes to the
same-origin runner. The runner owns provider configuration and credentials.
The browser receives bounded tool calls, validates them against its current
Region, and reports the resulting receipt.

## Keep the host boundary

- Keep the API key in the local process or application server.
- Set the provider URL and model in trusted configuration, never tool input.
- Tell users which data may leave the application.
- Bound tool calls, elapsed time, request size, and retries.
- Do not store prompts or credentials by default.

The local runner pairs one browser Region with an expiring session. Disconnect
and reset cancel pending work and release the pairing. See
[agent recovery](/agents/recovery/) and [data boundaries](/concepts/safety/)
for failure handling.

## Plan a shared deployment

The static production site runs no model. The local runner is a loopback
development option. A shared server needs authenticated users, scoped
sessions, origin and CSRF checks, rate and cost limits, and an explicit
retention policy before it can accept model requests. Keep model output as
validated intents; never render generated HTML or execute generated code.

<nav class="doc-next" aria-label="Continue reading"><p>Continue reading</p><a href="/agents/mcp/"><span>MCP transport</span><small>Let an external client drive the same session.</small><b aria-hidden="true">→</b></a><a href="/agents/recovery/"><span>Agent recovery</span><small>Handle expiry, failure, and uncertain outcomes.</small><b aria-hidden="true">→</b></a></nav>
