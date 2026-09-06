// @vitest-environment node
import { afterEach, expect, it } from "vitest";
import { createScriptedProvider } from "@aeliqo/byok";
import { createLocalByokServer } from "../examples/byok-local-server";

let app: ReturnType<typeof createLocalByokServer> | undefined;
afterEach(async () => app?.close());

it("keeps the public BYOK recipe on authenticated loopback and never accepts keys in input", async () => {
  app = createLocalByokServer({
    provider: createScriptedProvider([{ calls: [], text: "Fixture only" }]),
  });
  await app.ready;
  const url = `http://127.0.0.1:${app.port}/byok`;
  const invoke = (body: unknown, token = app!.mcp.bridge.pairingToken) =>
    fetch(url, {
      method: "POST",
      headers: {
        Origin: "http://127.0.0.1:5173",
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
  expect((await invoke({ intent: "Inspect" }, "wrong")).status).toBe(401);
  expect((await invoke({ intent: "Inspect", apiKey: "forbidden" })).status).toBe(
    400,
  );
  expect((await invoke({ intent: "Inspect" })).status).toBe(200);
  expect(
    (
      await fetch(url, {
        method: "POST",
        headers: {
          Origin: "https://untrusted.example",
          Authorization: `Bearer ${app.mcp.bridge.pairingToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ intent: "Inspect" }),
      })
    ).status,
  ).toBe(403);
});
