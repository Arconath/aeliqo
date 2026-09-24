import { expect, test } from '@playwright/test';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { request as httpRequest } from 'node:http';
import { createServer as createTcpServer } from 'node:net';
import { fileURLToPath } from 'node:url';
import { connectMcpHttpClient, connectMcpStdioClient } from '../../../../packages/agent/dist/mcp/index.js';

test('the local runner pairs one browser Region with the three real MCP tools', async ({ page, baseURL }, testInfo) => {
  if (baseURL === undefined) throw new Error('The local-runner test requires a configured base URL.');
  await page.goto('/playground/');
  await expect(page.locator('#pg-receipt-state')).toHaveText('renderer-ready');
  await page.getByRole('button', { name: 'Connect AI' }).click();
  await page.getByRole('button', { name: 'Check local connection' }).click();
  await expect(page.locator('#pg-connect-status')).toContainText('Local agent host connected');
  await expect(page.getByRole('textbox', { name: 'Prompt' })).toBeDisabled();

  const token = testInfo.config.metadata.token;
  if (typeof token !== 'string' || token.length === 0) throw new Error('The local-runner test requires an MCP token.');
  const endpoint = await connectMcpHttpClient({
    url: `${baseURL}/mcp`,
    targetRegionId: 'playground-main',
    goalEpoch: 'local-playground',
    policy: { allowInsecureLoopback: true },
    requestInit: { headers: { authorization: `Bearer ${token}` } },
  });
  try {
    const discovered = await endpoint.discover();
    expect(discovered).toMatchObject({ ok: true });
    if (!discovered.ok) return;
    expect(discovered.value.map(({ name }) => name).sort()).toEqual(['aeliqo_act', 'aeliqo_context', 'aeliqo_render']);

    await expect(endpoint.invoke('aeliqo_context', {}, { requestId: 'local-context' })).resolves.toMatchObject({
      ok: true,
      value: { state: 'accepted' },
    });
    await expect(
      endpoint.invoke(
        'aeliqo_render',
        {
          version: '1',
          id: 'local-products',
          kind: 'browse',
          resource: 'products',
          fields: ['name', 'category', 'price'],
          preferredView: 'cards',
        },
        { requestId: 'local-render' },
      ),
    ).resolves.toMatchObject({ ok: true, value: { state: 'renderer-ready' } });
    await expect(page.locator('#pg-status')).toContainText('is ready');
    await expect(page.locator('aeliqo-card-collection')).toContainText('Desk lamp');
  } finally {
    endpoint.close();
  }

  const stdio = await connectMcpStdioClient({
    server: {
      command: process.execPath,
      args: [fileURLToPath(new URL('../../runner/mcp-stdio.mjs', import.meta.url))],
      env: { ...process.env, AELIQO_LOCAL_URL: baseURL, AELIQO_MCP_TOKEN: token },
      stderr: 'pipe',
    },
    targetRegionId: 'playground-main',
    goalEpoch: 'local-playground',
  });
  try {
    const discovered = await stdio.discover();
    expect(discovered.ok && discovered.value.map(({ name }) => name).sort()).toEqual([
      'aeliqo_act',
      'aeliqo_context',
      'aeliqo_render',
    ]);
    await expect(stdio.invoke('aeliqo_context', {}, { requestId: 'stdio-context' })).resolves.toMatchObject({
      ok: true,
      value: { state: 'accepted' },
    });
  } finally {
    stdio.close();
  }
});

test('the local runner rejects untrusted origins and invalid MCP credentials', async ({ request, baseURL }) => {
  const rejectedOrigin = await request.get(`${baseURL}/api/aeliqo/session`, {
    headers: { origin: 'https://attacker.example' },
  });
  expect(rejectedOrigin.status()).toBe(403);
  const rejectedToken = await request.post(`${baseURL}/mcp`, {
    headers: { authorization: 'Bearer wrong-token', 'content-type': 'application/json' },
    data: {},
  });
  expect(rejectedToken.status()).toBe(401);
  const rejectedNavigation = await request.get(`${baseURL}/api/aeliqo/session`, { headers: { accept: 'text/html' } });
  expect(rejectedNavigation.status()).toBe(406);
  const oversizedMcp = await request.post(`${baseURL}/mcp`, {
    headers: { authorization: 'Bearer wrong-token', 'content-type': 'application/json' },
    data: { padding: 'x'.repeat(260_000) },
  });
  expect(oversizedMcp.status()).toBe(413);
});

test('the local runner reserves one prompt before reading the request body', async () => {
  const listener = createTcpServer();
  listener.listen(0, '127.0.0.1');
  await once(listener, 'listening');
  const address = listener.address();
  if (address === null || typeof address === 'string') throw new Error('No test port was assigned.');
  const port = address.port;
  const listenerClosed = once(listener, 'close');
  listener.close();
  await listenerClosed;

  const env = { ...process.env };
  for (const key of Object.keys(env)) if (key.startsWith('AELIQO_MODEL_')) delete env[key];
  Object.assign(env, {
    AELIQO_PLAYGROUND_PORT: String(port),
    AELIQO_MODEL_BASE_URL: 'http://127.0.0.1:9/v1/',
    AELIQO_MODEL: 'mock-model',
    AELIQO_MODEL_PROTOCOL: 'openai-compatible-chat',
    AELIQO_MODEL_AUTH_SCHEME: 'none',
    AELIQO_MODEL_CAPABILITIES: 'tool-calls,usage',
    AELIQO_ALLOW_INSECURE_MODEL_HTTP: '1',
  });
  const server = spawn(process.execPath, [fileURLToPath(new URL('../../runner/server.mjs', import.meta.url))], {
    env,
    stdio: 'ignore',
  });
  const serverExited = once(server, 'exit');
  const base = `http://127.0.0.1:${port}`;
  const streamController = new AbortController();
  let first: ReturnType<typeof httpRequest> | undefined;
  try {
    let session: Response | undefined;
    for (let attempt = 0; attempt < 40 && session === undefined; attempt += 1) {
      try {
        session = await fetch(`${base}/api/aeliqo/session`, { headers: { accept: 'application/json' } });
      } catch {
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
    }
    expect(session?.status).toBe(200);
    const cookie = session?.headers.get('set-cookie')?.split(';')[0];
    if (cookie === undefined) throw new Error('No local session cookie was issued.');
    const stream = await fetch(`${base}/api/aeliqo/events`, {
      headers: { cookie },
      signal: streamController.signal,
    });
    expect(stream.status).toBe(200);
    await stream.body?.getReader().read();

    const firstRequest = httpRequest(`${base}/api/aeliqo/prompt`, {
      method: 'POST',
      headers: { cookie, accept: 'application/json', 'content-type': 'application/json', 'content-length': '2' },
    });
    first = firstRequest;
    const firstResponse = new Promise<number>((resolve, reject) => {
      firstRequest.on('response', (response) => {
        response.resume();
        response.on('end', () => resolve(response.statusCode ?? 0));
      });
      firstRequest.on('error', reject);
    }).catch(() => 0);
    firstRequest.write('{');
    await new Promise((resolve) => setTimeout(resolve, 100));

    const second = await fetch(`${base}/api/aeliqo/prompt`, {
      method: 'POST',
      headers: { cookie, accept: 'application/json', 'content-type': 'application/json' },
      body: JSON.stringify({ prompt: 'synthetic request' }),
      signal: AbortSignal.timeout(2_000),
    });
    expect(second.status).toBe(429);
    firstRequest.end('!');
    expect(await firstResponse).toBe(400);
    const retry = await fetch(`${base}/api/aeliqo/prompt`, {
      method: 'POST',
      headers: { cookie, accept: 'application/json', 'content-type': 'application/json' },
      body: '{!',
    });
    expect(retry.status).toBe(400);
  } finally {
    first?.destroy();
    streamController.abort();
    server.kill('SIGKILL');
    await serverExited;
  }
});
