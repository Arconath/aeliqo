---
id: 'byok'
path: '/agents/byok/'
section: 'Connect agents'
title: 'Bring your own model'
description: 'Run the provider SDK and bounded tool loop in a trusted host process without sending keys to the public playground.'
---

BYOK connects a user's own provider account to Aeliqo's bounded tool loop.
The local runner keeps the key in a trusted host process. The hosted Playground
also offers a direct browser connection to DeepSeek; the browser sends requests
straight to DeepSeek and Aeliqo does not receive or proxy the key.

## Configure the local runner

Copy the example file, then set all three model values in `apps/site/.env.local`:

```sh
cp apps/site/.env.example apps/site/.env.local
```

```dotenv
AELIQO_MODEL_BASE_URL=https://your-provider.example/v1/
AELIQO_MODEL=your-tool-capable-model
AELIQO_MODEL_API_KEY=your-local-secret
```

Start the runner from the repository root:

```sh
pnpm playground:local
```

Open the local URL it prints, choose **Connected agent**, and select the local
host. The prompt control stays unavailable until the runner has a complete
configuration and the browser acknowledges the session. The runner binds to
loopback by default. For an HTTP test endpoint on loopback, also set
`AELIQO_ALLOW_INSECURE_MODEL_HTTP=1`; remote model endpoints must use HTTPS.

## Keep the host boundary

- Keep the API key in the local process or application server.
- Set the provider URL and model in trusted configuration, never tool input.
- Tell users which data may leave the application.
- Bound tool calls, elapsed time, request size, and retries.
- Do not store prompts or credentials by default.

The local runner pairs one browser Region with an expiring session. Disconnect
and reset cancel pending work and release the pairing. See [agent recovery](/agents/recovery/)
and [data boundaries](/concepts/safety/) for failure handling.

## Use DeepSeek from the hosted Playground

In **Connected agent**, select **DeepSeek BYOK (direct from browser)**. Read the
disclosure, opt in, and enter your own DeepSeek API key. The Playground uses the
fixed `https://api.deepseek.com/chat/completions` endpoint and the
`deepseek-flash` model; it does not accept a custom base URL or use an Aeliqo
provider key.

The key is held in the password field until connection, then only in a
short-lived browser memory closure. It is cleared on disconnect, reset, or page
close. It is not written to `localStorage`, `sessionStorage`, cookies, URLs,
telemetry, logs, or Aeliqo requests. The browser request omits cookies, does
not follow redirects, and is limited to four provider requests, four tool calls, 45 seconds, 1,024
output tokens per request, and 32 KiB request and response bodies.

The prompt, selected synthetic scenario context, tool definitions, and bounded
synthetic metadata returned by the tools are sent directly to DeepSeek. DeepSeek
charges usage to the account that owns the key. Playground records remain in
the browser; model-generated intents still pass through Aeliqo's dispatcher,
and actions still require the existing user confirmation.

The production image serves static files and does not include the local runner,
a model endpoint, or an Aeliqo provider key. The local runner remains a
loopback-only development option. If you build a separate shared gateway for
server-held credentials, authenticate and isolate each user, authorize tool
calls against that user's data, and set per-user rate, concurrency, token, cost,
time, and payload limits. Add origin and CSRF checks, require user approval for
writes, and define prompt and record retention. Keep model output as validated
intents; never render generated HTML or execute generated code.
