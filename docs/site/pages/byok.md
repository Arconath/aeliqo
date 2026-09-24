---
id: 'byok'
path: '/agents/byok/'
section: 'Connect agents'
title: 'Bring your own model'
description: 'Connect a provider through a trusted local host while keeping credentials outside the browser.'
---

BYOK connects a user's own provider account to Aeliqo's bounded tool loop. The
local runner keeps the key in a trusted host process. The public Playground has
no browser provider-key field and does not send requests directly to a model.

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

Open the local URL it prints, choose **Connect AI**, and select the local
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

## Prompt from the local host

In **Connect AI**, select **Local Playground host** and check the connection.
The host sets a short-lived, HttpOnly session cookie. The browser pairs its
current Region over a same-origin event stream, and the prompt is sent to the
same-origin runner. The runner owns provider configuration and credentials.
The browser receives bounded tool calls, validates them against its current
Region, and reports the resulting receipt. A failed proposal does not commit
an unsupported UI change.

The static production site does not run a model. The local runner is a
loopback development option. A shared server deployment needs authenticated
users, scoped sessions, origin and CSRF checks, rate and cost limits, and an
explicit retention policy before it can accept model requests. Keep model
output as validated intents; never render generated HTML or execute generated
code.
