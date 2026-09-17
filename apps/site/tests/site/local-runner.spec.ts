import { expect, test } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import { connectMcpHttpClient, connectMcpStdioClient } from '../../../../packages/agent/dist/mcp/index.js';

test('the local runner pairs one browser Region with the three real MCP tools', async ({ page, baseURL }, testInfo) => {
  if (baseURL === undefined) throw new Error('The local-runner test requires a configured base URL.');
  await page.goto('/playground/');
  await expect(page.locator('#pg-receipt-state')).toHaveText('renderer-ready');
  await page.getByRole('button', { name: 'Connected agent' }).click();
  await page.getByRole('button', { name: 'Check connection' }).click();
  await expect(page.locator('#pg-connect-status')).toContainText('Local agent host connected');
  await expect(page.getByRole('textbox', { name: 'Local BYOK prompt' })).toBeDisabled();

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
    await expect(page.locator('#pg-status')).toContainText('data.card-collection renderer');
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
