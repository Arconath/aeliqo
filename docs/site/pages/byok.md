---
id: "byok"
path: "/agents/byok/"
section: "Connect agents"
title: "Bring your own model"
description: "Run the provider SDK and bounded tool loop in a trusted host process without sending keys to the public playground."
---

BYOK runs the provider SDK and bounded tool loop in a trusted host process.
The host selects the provider and model, holds credentials, sets data egress
policy, and handles disclosure and retention. The playground uses synthetic
records.

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
