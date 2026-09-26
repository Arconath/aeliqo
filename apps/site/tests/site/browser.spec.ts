import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page, type WebSocketRoute } from '@playwright/test';
import { componentCatalog } from '../shared/catalog.js';
import { RELEASE_VERSION } from '../../../../scripts/release/metadata.mjs';

interface RelayStubState {
  pairCalls: number;
  acks: { id: string; ok: boolean; result?: unknown; error?: unknown }[];
  urls: string[];
}

/**
 * Stubs the hosted relay without touching the real domain: fetches to
 * mcp.aeliqo.com are answered in-page and SSE attach URLs land on a fake
 * EventSource. WebSocket attach URLs go through Playwright's routeWebSocket.
 */
async function stubHostedRelay(
  page: Page,
  options: { attach?: 'sse' | 'ws'; pairStatus?: number; networkError?: boolean; expiresInSeconds?: number } = {},
): Promise<void> {
  await page.addInitScript(
    ({ attach, pairStatus, networkError, expiresInSeconds }) => {
      const stub = {
        pairCalls: 0,
        acks: [] as unknown[],
        streams: [] as {
          url: string;
          emit(name: string, value: unknown): void;
          fail(): void;
        }[],
      };
      Object.defineProperty(window, '__aeliqoRelayStub', { value: stub, configurable: true });
      const realFetch = window.fetch.bind(window);
      window.fetch = (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
        const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
        if (!url.startsWith('https://mcp.aeliqo.com/')) return realFetch(input, init);
        if (networkError) return Promise.reject(new TypeError('Failed to fetch'));
        if (url === 'https://mcp.aeliqo.com/pair') {
          stub.pairCalls += 1;
          if (pairStatus !== 200) return Promise.resolve(new Response('unavailable', { status: pairStatus }));
          return Promise.resolve(
            new Response(
              JSON.stringify({
                token: 'relay-test-token',
                attachUrl:
                  attach === 'ws'
                    ? 'wss://mcp.aeliqo.com/attach?token=relay-test-token'
                    : 'https://mcp.aeliqo.com/attach?token=relay-test-token',
                mcpUrl: 'https://mcp.aeliqo.com/mcp',
                expiresAt: Math.floor(Date.now() / 1000) + expiresInSeconds,
              }),
              { status: 200, headers: { 'content-type': 'application/json' } },
            ),
          );
        }
        if (url === 'https://mcp.aeliqo.com/ack') {
          stub.acks.push(JSON.parse(typeof init?.body === 'string' ? init.body : '{}'));
          return Promise.resolve(new Response(null, { status: 204 }));
        }
        return Promise.resolve(new Response('{}', { status: 404 }));
      };
      if (attach !== 'sse') return;
      class FakeEventSource extends EventTarget {
        static readonly CONNECTING = 0;
        static readonly OPEN = 1;
        static readonly CLOSED = 2;
        readonly CONNECTING = 0;
        readonly OPEN = 1;
        readonly CLOSED = 2;
        readonly url: string;
        readonly withCredentials = false;
        readyState = 0;
        onopen: ((event: Event) => void) | null = null;
        onerror: ((event: Event) => void) | null = null;
        onmessage: ((event: MessageEvent) => void) | null = null;
        private gone = false;
        constructor(url: string | URL) {
          super();
          this.url = String(url);
          stub.streams.push(this);
          setTimeout(() => {
            if (this.gone) return;
            this.readyState = 1;
            this.dispatchEvent(new Event('open'));
          }, 0);
        }
        emit(name: string, value: unknown): void {
          if (this.gone) return;
          this.dispatchEvent(new MessageEvent(name, { data: JSON.stringify(value) }));
        }
        fail(): void {
          this.readyState = 2;
          this.dispatchEvent(new Event('error'));
        }
        close(): void {
          this.gone = true;
          this.readyState = 2;
        }
      }
      window.EventSource = FakeEventSource as unknown as typeof EventSource;
    },
    {
      attach: options.attach ?? 'sse',
      pairStatus: options.pairStatus ?? 200,
      networkError: options.networkError ?? false,
      expiresInSeconds: options.expiresInSeconds ?? 900,
    },
  );
}

function relayStubState(page: Page): Promise<RelayStubState> {
  return page.evaluate(() => {
    const stub = (
      window as unknown as {
        __aeliqoRelayStub: { pairCalls: number; acks: RelayStubState['acks']; streams: { url: string }[] };
      }
    ).__aeliqoRelayStub;
    return { pairCalls: stub.pairCalls, acks: stub.acks, urls: stub.streams.map((stream) => stream.url) };
  });
}

/** Emits one named event on the latest fake SSE attach stream. */
function emitRelayEvent(page: Page, name: string, value: unknown): Promise<boolean> {
  return page.evaluate(
    ({ eventName, payload }: { eventName: string; payload: unknown }) => {
      const stub = (
        window as unknown as {
          __aeliqoRelayStub?: { streams: { emit(n: string, v: unknown): void; fail(): void }[] };
        }
      ).__aeliqoRelayStub;
      const stream = stub?.streams.at(-1);
      if (stream === undefined) return false;
      if (eventName === 'error') stream.fail();
      else stream.emit(eventName, payload);
      return true;
    },
    { eventName: name, payload: value },
  );
}

async function openRelayPanel(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Connect AI' }).click();
  await page.locator('#pg-connection-kind').selectOption('relay');
}

test('the public playground uses the app facade without AI and through scenario steps', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/playground/');
  await expect(page.locator('#pg-boot')).toBeHidden();
  await expect(page.locator('#pg-receipt-state')).toHaveText('renderer-ready');
  await expect(page.locator('#pg-journey-intent')).toHaveText('Browse people');
  await expect(page.locator('#pg-journey-result')).toHaveText('Evaluated');
  await expect(page.locator('#pg-journey-view')).toHaveText('Table');
  await expect(page.locator('#pg-receipt-state')).toBeHidden();
  await expect(page.locator('aeliqo-table')).toContainText('Ada Chen');
  await page.getByRole('button', { name: 'Open Ada' }).click();
  await expect(page.locator('aeliqo-detail')).toContainText('Ada Chen');
  await expect(page.locator('#pg-journey-view')).toHaveText('Detail');
  await expect(page.locator('#pg-model-calls')).toHaveText('0');
  await page.screenshot({ path: 'artifacts/site-browser/playground-desktop.png', fullPage: true });
  expect(errors).toEqual([]);
});

test('the scenario query parameter deep-links a documented playground example', async ({ page }) => {
  await page.goto('/playground/?scenario=products');
  await expect(page.locator('#pg-boot')).toBeHidden();
  await expect(page.locator('#pg-scenario')).toHaveValue('products');
  await expect(page.locator('#pg-journey-intent')).toHaveText('Browse products');
  await page.locator('#pg-scenario').selectOption('knowledge');
  await expect(page).toHaveURL(/scenario=knowledge/);
  await page.goto('/playground/?scenario=bogus');
  await expect(page.locator('#pg-boot')).toBeHidden();
  await expect(page.locator('#pg-scenario')).toHaveValue('people');
});

test('guided demos show Jakarta people, daily attendance, and a composed workspace without AI', async ({ page }) => {
  await page.goto('/playground/');
  await page.getByRole('button', { name: 'People in Jakarta' }).click();
  await expect(page.locator('#pg-committed-filter')).toContainText('Jakarta');
  await expect(page.locator('aeliqo-table')).toContainText('Ada Chen');
  await expect(page.locator('aeliqo-table')).not.toContainText('Sam Rivera');
  await page.getByRole('button', { name: 'Daily attendance' }).click();
  await expect(page.locator('[data-testid="attendance-status"]')).toContainText('renderer-ready');
  await expect(page.locator('[data-testid="attendance-status"]')).toBeHidden();
  await expect(page.locator('#pg-status')).toContainText('Daily attendance is ready.');
  await expect(page.locator('[data-testid="period"]')).toContainText('Asia/Jakarta');
  await expect(page.locator('[data-testid="daily-values"]')).toContainText('2026-09-02: 0.5');
  await page.getByRole('button', { name: 'Compare attendance metrics' }).click();
  await expect(page.locator('#metric-choice')).toBeVisible();
  await expect(page.locator('#pg-journey-result')).toHaveText('Needs a choice');
  await expect(page.locator('#pg-journey-view')).toHaveText('Choose a metric');
  await page.getByRole('button', { name: 'Inspect', exact: true }).click();
  await page.locator('[data-inspector="intent"]').click();
  await expect(page.locator('#pg-inspector-content')).toContainText('Analyze daily attendance');
  await page.locator('[data-inspector="diagnostics"]').click();
  await expect(page.locator('#pg-inspector-content')).toContainText('needs-input:web.recipe.needs-input.measure');
  await expect(page.locator('#pg-inspector-content')).not.toContainText('Analyze daily attendance');
  await page.getByRole('button', { name: 'Close inspector' }).click();
  await page.getByRole('button', { name: 'Analytical workspace' }).click();
  await expect(page.locator('[data-testid="goal-status"]')).toHaveText('renderer-ready');
  await expect(page.locator('[data-testid="goal-status"]')).toBeHidden();
  await expect(page.locator('#pg-status')).toContainText('Analytical workspace is ready.');
  await expect(page.locator('[data-testid="goal-workspace"]')).toHaveAttribute('data-needs', 'summary,trend,breakdown');
  await page.getByRole('button', { name: 'Request anomaly' }).click();
  await expect(page.locator('[data-testid="goal-status"]')).toContainText('unsupported:intent.unknown-custom');
  await expect(page.locator('[data-testid="goal-workspace"]')).toContainText('Ada');
  await page.locator('#pg-menu > summary').click();
  await page.getByRole('button', { name: 'Reset playground' }).click();
  await page.getByRole('button', { name: 'Analytical workspace' }).click();
  await expect(page.locator('[data-testid="goal-status"]')).toHaveText('renderer-ready');
  await expect(page.locator('#pg-model-calls')).toHaveText('0');
});

test('theme selection follows the system, updates mounted components, and persists an override', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('/playground/');
  await expect(page.locator('#pg-receipt-state')).toHaveText('renderer-ready');
  const theme = page.getByRole('combobox', { name: 'Theme' });
  const region = page.locator('aeliqo-region[data-aeliqo-theme]');
  await expect(theme).toHaveValue('system');
  await expect(page.locator('html')).not.toHaveAttribute('data-theme');
  await expect(region).toHaveAttribute('data-aeliqo-theme', 'dark');

  await theme.selectOption('light');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await expect(region).toHaveAttribute('data-aeliqo-theme', 'light');
  await page.reload();
  await expect(theme).toHaveValue('light');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await expect(page.locator('aeliqo-region[data-aeliqo-theme]')).toHaveAttribute('data-aeliqo-theme', 'light');

  await theme.selectOption('dark');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.locator('aeliqo-region[data-aeliqo-theme]')).toHaveAttribute('data-aeliqo-theme', 'dark');
});

test('connected-agent mode never fabricates MCP, WebMCP, or BYOK evidence', async ({ page }) => {
  const requests: string[] = [];
  page.on('request', (request) => requests.push(request.url()));
  await page.goto('/playground/');
  await page.getByRole('button', { name: 'Connect AI' }).click();
  await expect(page.locator('#pg-webmcp-note')).toBeVisible();
  await expect(page.locator('#pg-webmcp-note')).toContainText('early-preview Chrome');
  await expect(page.locator('#pg-webmcp-note a[href="/agents/webmcp/"]')).toBeAttached();
  await expect(page.locator('#pg-webmcp-note a[href="/agents/mcp/"]')).toBeAttached();
  await page.locator('#pg-connection-kind').selectOption('detect');
  await page.getByRole('button', { name: 'Check connection' }).click();
  await expect(page.locator('#pg-connect-status')).not.toContainText('Checking capability');
  await expect(page.getByRole('textbox', { name: 'Prompt' })).toBeDisabled();
  await expect(page.locator('#pg-model-calls')).toHaveText('0');
  await page.locator('#pg-connection-kind').selectOption('webmcp');
  await page.getByRole('button', { name: 'Check connection' }).click();
  await expect(page.locator('#pg-connect-status')).toContainText(/WebMCP|browser/i);
  expect(requests.some((url) => url.includes('/api/aeliqo/session'))).toBe(true);
  expect(requests.every((url) => new URL(url).hostname === '127.0.0.1')).toBe(true);
});

test('the scripted demo agent runs listed requests and declines unknown phrasing honestly', async ({ page }) => {
  const requests: string[] = [];
  page.on('request', (request) => requests.push(request.url()));
  await page.goto('/playground/');
  await expect(page.locator('#pg-receipt-state')).toHaveText('renderer-ready');
  await page.getByRole('button', { name: 'Connect AI' }).click();
  await page.locator('#pg-connection-kind').selectOption('demo');
  await page.getByRole('button', { name: 'Check connection' }).click();
  await expect(page.locator('#pg-connect-status')).toContainText('Scripted demo');
  await expect(page.locator('#pg-connection-label')).toContainText('no model calls');
  await page.getByRole('button', { name: 'Engineering only' }).last().click();
  await expect(page.locator('aeliqo-table')).toContainText('Sam Rivera');
  await expect(page.locator('aeliqo-table')).not.toContainText('Ada Chen');
  await expect(page.locator('#pg-model-calls')).toHaveText('0');
  await page.getByRole('textbox', { name: 'Prompt' }).fill('summarize the quarterly revenue');
  await page.getByRole('button', { name: 'Send to demo agent' }).click();
  await expect(page.locator('#pg-connect-status')).toContainText('only understands the listed');
  expect(requests.every((url) => new URL(url).hostname === '127.0.0.1')).toBe(true);
});

test('simulated WebMCP host registers the standard tools and renders through the current Region', async ({ page }) => {
  await page.addInitScript(() => {
    const tools = new Map<string, unknown>();
    Object.defineProperty(document, 'modelContext', {
      value: {
        registerTool(tool: { name: string }) {
          tools.set(tool.name, tool);
        },
        async getTools() {
          return [...tools.values()];
        },
      },
    });
    Object.defineProperty(globalThis, '__aeliqoWebMcpTools', { value: tools });
  });
  await page.goto('/playground/');
  await expect(page.locator('#pg-receipt-state')).toHaveText('renderer-ready');
  await page.getByRole('button', { name: 'Connect AI' }).click();
  await page.locator('#pg-connection-kind').selectOption('webmcp');
  await page.getByRole('button', { name: 'Check connection' }).click();
  await expect(page.locator('#pg-connect-status')).toContainText('registered 3 tools');
  const result = await page.evaluate(async () => {
    const tools = (
      globalThis as typeof globalThis & {
        __aeliqoWebMcpTools: Map<string, { execute(input: unknown): Promise<unknown> }>;
      }
    ).__aeliqoWebMcpTools;
    const names = [...tools.keys()].sort();
    const context = await tools.get('aeliqo_context')?.execute({});
    const render = await tools.get('aeliqo_render')?.execute({
      version: '1',
      id: 'webmcp-engineering',
      kind: 'browse',
      resource: 'people',
      fields: ['name', 'team', 'location'],
      filter: { op: 'compare', field: 'team', comparison: 'eq', value: 'Engineering' },
    });
    const detail = await tools.get('aeliqo_render')?.execute({
      version: '1',
      id: 'webmcp-person-detail',
      kind: 'detail',
      resource: 'people',
      identity: { id: 'p-1' },
    });
    return { names, context, render, detail };
  });
  expect(result.names).toEqual(['aeliqo_act', 'aeliqo_context', 'aeliqo_render']);
  expect(result.context).toMatchObject({ ok: true, value: { state: 'accepted' } });
  expect(result.render).toMatchObject({ ok: true, value: { state: 'renderer-ready' } });
  expect(result.detail).toMatchObject({ ok: true, value: { state: 'renderer-ready' } });
  await expect(page.locator('aeliqo-detail')).toContainText('Ada Chen');
  const trend = await page.evaluate(async () => {
    const tools = (
      globalThis as typeof globalThis & {
        __aeliqoWebMcpTools: Map<string, { execute(input: unknown): Promise<unknown> }>;
      }
    ).__aeliqoWebMcpTools;
    return tools.get('aeliqo_render')?.execute({
      version: '1',
      id: 'people-trend',
      kind: 'analyze',
      resource: 'workforce-headcount',
      measures: [{ id: 'month-end-headcount', revision: '1' }],
      time: { field: 'month', grain: 'month', calendar: 'gregorian', timezone: 'UTC' },
      preferredView: 'trend',
      sort: [{ field: 'month', direction: 'asc' }],
    });
  });
  expect(trend).toMatchObject({ ok: true, value: { state: 'renderer-ready' } });
  await expect(page.locator('aeliqo-chart')).toBeVisible();
  await expect(page.locator('#pg-result-title')).toHaveText('Monthly headcount');
  await expect(page.locator('#pg-result-definition')).toContainText('never summed across months');
  await expect(page.getByRole('textbox', { name: 'Prompt' })).toBeDisabled();
});

test('the hosted relay pairs a session, proxies calls through the Region, and reports detachment', async ({ page }) => {
  const requests: string[] = [];
  page.on('request', (request) => requests.push(request.url()));
  await stubHostedRelay(page);
  await page.goto('/playground/');
  await expect(page.locator('#pg-receipt-state')).toHaveText('renderer-ready');
  await openRelayPanel(page);
  await expect(page.getByRole('button', { name: 'Check connection' })).toBeHidden();
  await page.getByRole('button', { name: 'Generate connection' }).click();
  await expect(page.locator('#pg-connect-status')).toContainText('Relay connected');
  await expect(page.locator('#pg-mcp-relay-json')).toContainText('"type": "streamable-http"');
  await expect(page.locator('#pg-mcp-relay-json')).toContainText('https://mcp.aeliqo.com/mcp');
  await expect(page.locator('#pg-mcp-relay-json')).toContainText('Bearer relay-test-token');
  await expect(page.locator('#pg-mcp-relay-cli')).toContainText(
    'claude mcp add --transport http aeliqo-playground https://mcp.aeliqo.com/mcp',
  );
  await expect(page.locator('#pg-mcp-relay-cli')).toContainText('"Authorization: Bearer relay-test-token"');
  await expect(page.locator('#pg-relay-expiry')).toContainText('expires at');
  await expect(page.locator('#pg-relay-expiry')).toContainText('Regenerate');
  await expect(page.getByRole('textbox', { name: 'Prompt' })).toBeDisabled();
  const stub = await relayStubState(page);
  expect(stub.pairCalls).toBe(1);
  expect(stub.urls.at(-1)).toBe('https://mcp.aeliqo.com/attach?token=relay-test-token');

  expect(await emitRelayEvent(page, 'cancel', { kind: 'cancel', id: 'relay-none' })).toBe(true);
  expect(
    await emitRelayEvent(page, 'call', {
      kind: 'call',
      id: 'relay-call-1',
      method: 'invoke',
      params: {
        name: 'aeliqo_render',
        input: {
          version: '1',
          id: 'relay-engineering',
          kind: 'browse',
          resource: 'people',
          fields: ['name', 'team', 'location'],
          filter: { op: 'compare', field: 'team', comparison: 'eq', value: 'Engineering' },
        },
        requestId: 'relay-render-1',
      },
    }),
  ).toBe(true);
  await expect(page.locator('aeliqo-table')).toContainText('Sam Rivera');
  await expect(page.locator('aeliqo-table')).not.toContainText('Ada Chen');
  await expect(page.locator('#pg-journey-view')).toHaveText('Table');
  const acks = (await relayStubState(page)).acks;
  expect(acks).toHaveLength(1);
  expect(acks[0]).toMatchObject({ id: 'relay-call-1', ok: true });

  expect(await emitRelayEvent(page, 'error', undefined)).toBe(true);
  await expect(page.locator('#pg-connect-status')).toContainText(/detached|disconnected/i);
  expect(requests.every((url) => !new URL(url).hostname.endsWith('aeliqo.com'))).toBe(true);
});

test('the hosted relay shows unreachable, HTTP failure, and expired states without hiding them', async ({ page }) => {
  await stubHostedRelay(page, { networkError: true });
  await page.goto('/playground/');
  await openRelayPanel(page);
  await page.getByRole('button', { name: 'Generate connection' }).click();
  await expect(page.locator('#pg-connect-status')).toContainText('unreachable');

  await stubHostedRelay(page, { pairStatus: 503 });
  await page.reload();
  await openRelayPanel(page);
  await page.getByRole('button', { name: 'Generate connection' }).click();
  await expect(page.locator('#pg-connect-status')).toContainText('could not create a session');

  await stubHostedRelay(page, { expiresInSeconds: 2 });
  await page.reload();
  await openRelayPanel(page);
  await page.getByRole('button', { name: 'Generate connection' }).click();
  await expect(page.locator('#pg-connect-status')).toContainText('expired', { timeout: 10_000 });
  await page.getByRole('button', { name: 'Regenerate connection' }).click();
  await expect(page.locator('#pg-connect-status')).toContainText('Relay connected');
  expect((await relayStubState(page)).pairCalls).toBe(2);
});

test('the hosted relay attaches over WebSocket and acknowledges discovery on /ack', async ({ page }) => {
  let socket: WebSocketRoute | undefined;
  await page.routeWebSocket(/mcp\.aeliqo\.com\/attach/, (ws) => {
    socket = ws;
  });
  await stubHostedRelay(page, { attach: 'ws' });
  await page.goto('/playground/');
  await openRelayPanel(page);
  await page.getByRole('button', { name: 'Generate connection' }).click();
  await expect(page.locator('#pg-connect-status')).toContainText('Relay connected');
  const ws = socket;
  expect(ws).toBeDefined();
  if (ws === undefined) return;
  ws.send(JSON.stringify({ kind: 'call', id: 'ws-call-1', method: 'tools/list', params: {} }));
  await expect.poll(async () => (await relayStubState(page)).acks.length).toBe(1);
  const acks = (await relayStubState(page)).acks;
  expect(acks[0]).toMatchObject({ id: 'ws-call-1', ok: true });
  expect(JSON.stringify(acks[0]?.result)).toContain('aeliqo_render');
  ws.close();
  await expect(page.locator('#pg-connect-status')).toContainText(/detached|disconnected/i);
});

test('candidate playground does not offer a ZIP pinned to an unpublished release', async ({ page }) => {
  test.skip(process.env.AELIQO_EXPORT_VERIFIED_VERSION === RELEASE_VERSION, 'Stable export is enabled.');
  await page.goto('/playground/');
  await page.locator('#pg-scenario').selectOption('knowledge');
  await page.locator('#pg-menu > summary').click();
  await expect(page.getByRole('button', { name: 'Export project' })).toBeDisabled();
  await expect(page.locator('#pg-export-note')).toContainText('matching Aeliqo packages');
  await expect(page.locator('#pg-export-note a')).toHaveAttribute('href', '/examples/');
  await page.locator('#pg-export-note a').click();
  await expect(page.getByRole('heading', { name: 'Run the playground from source' })).toBeVisible();
  await expect(page.locator('main')).toContainText('pnpm install --frozen-lockfile');
  await expect(page.locator('main')).toContainText('pnpm playground:local');
});

test('stable export follows the four base scenarios and never substitutes them for public journeys', async ({
  page,
}) => {
  test.skip(process.env.AELIQO_EXPORT_VERIFIED_VERSION !== RELEASE_VERSION, 'Requires verified stable export.');
  await page.goto('/playground/');
  const exportButton = page.getByRole('button', { name: 'Export project' });
  await page.locator('#pg-menu > summary').click();
  await expect(exportButton).toBeEnabled();
  for (const journey of ['jakarta', 'attendance', 'workspace']) {
    await page.locator(`[data-journey="${journey}"]`).click();
    await expect(exportButton).toBeDisabled();
    await expect(page.locator('#pg-export-note')).toContainText('no matching project ZIP');
    await expect(page.locator('#pg-export-note a')).toHaveAttribute('href', '/examples/');
    await page.locator('#pg-scenario').selectOption('products');
    await expect(exportButton).toBeEnabled();
    await expect(page.locator('#pg-export-note')).toBeHidden();
  }
  for (const scenario of ['people', 'products', 'support', 'knowledge']) {
    await page.locator('#pg-scenario').selectOption(scenario);
    await page.locator('#pg-menu > summary').click();
    const download = page.waitForEvent('download');
    await exportButton.click();
    expect((await download).suggestedFilename()).toBe(`aeliqo-${scenario}-example.zip`);
  }
});

test('home, deep docs, search, and narrow playground remain navigable', async ({ page }) => {
  const errors: string[] = [];
  const resizeObserverErrors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.exposeFunction('__aeliqoRecordResizeObserverError', (message: string) => {
    resizeObserverErrors.push(message);
  });
  await page.addInitScript(() => {
    window.addEventListener('error', (event) => {
      if (!event.message.startsWith('ResizeObserver loop')) return;
      void (
        window as unknown as Window & {
          __aeliqoRecordResizeObserverError(message: string): void;
        }
      ).__aeliqoRecordResizeObserverError(event.message);
    });
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/');
  await expect(page.locator('#demo-status')).toContainText('4 of 4');
  await page.screenshot({ path: 'artifacts/site-browser/home-desktop.png', fullPage: true });
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Skip to content' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('main')).toBeFocused();
  await page.locator('#team').selectOption('Engineering');
  await expect(page.locator('#demo-status')).toContainText('2 of 4');
  await page.setViewportSize({ width: 360, height: 800 });
  await page.screenshot({ path: 'artifacts/site-browser/home-mobile.png', fullPage: true });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/concepts/');
  await expect(page.getByRole('heading', { name: 'Watch the contract become a view.', exact: true })).toHaveCount(0);
  await page.getByRole('link', { name: 'Search docs' }).click();
  await page.getByRole('searchbox').fill('nonsensezzzzz');
  await expect(page.locator('aeliqo-dialog')).toContainText('No pages found');
  await page.getByRole('searchbox').fill('meaning');
  await expect(page.locator('aeliqo-dialog').getByRole('link').first()).toBeVisible();
  await page.keyboard.press('Escape');
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto('/playground/');
  await expect(page.locator('#pg-receipt-state')).toHaveText('renderer-ready');
  await expect(page.locator('aeliqo-card-collection')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('button', { name: 'Inspect', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Inspector' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Inspect', exact: true })).toBeFocused();
  await page.screenshot({ path: 'artifacts/site-browser/playground-mobile.png', fullPage: true });
  expect(errors).toEqual([]);
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  expect(resizeObserverErrors).toEqual([]);
});

test('home proof uses the public adaptive facade and remains legible on narrow forced-color surfaces', async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 900 });
  await page.goto('/');
  const records = page.locator('#home-demo');
  await expect(records).toHaveAttribute('role', 'region');
  await expect(records.locator('aeliqo-card-collection')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await expect((await new AxeBuilder({ page }).include('main').analyze()).violations).toEqual([]);
  await expect(page.locator('#demo-status')).toContainText('4 of 4 synthetic people matched');
  await page.locator('#team').selectOption('Engineering');
  await expect(page.locator('#demo-status')).toContainText('2 of 4 synthetic people matched');
  await expect(records).toContainText('Sam Rivera');
  await expect(records).not.toContainText('Ada Chen');
  await page.emulateMedia({ forcedColors: 'active' });
  const forced = await page.locator('#demo-status').evaluate((element) => {
    const style = getComputedStyle(element);
    return { color: style.color, background: style.backgroundColor };
  });
  expect(forced.color).not.toBe('rgb(17, 24, 39)');
  expect(forced.background).not.toBe('rgb(0, 0, 0)');
  expect(
    (await new AxeBuilder({ page }).include('main').analyze()).violations.filter(({ id }) => id === 'color-contrast'),
  ).toEqual([]);
  await page.locator('#demo-tab-code').click();
  await expect(page.locator('#demo-source')).toContainText('createAeliqoApp');
  await expect(page.locator('#demo-source')).toContainText("kind: 'browse'");
  await expect(page.locator('#demo-source')).not.toContainText('createTaskEvaluator');
});

test('every catalog route mounts its actual component and content remains readable without scripts', async ({
  page,
  browser,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  for (const component of componentCatalog) {
    await page.goto(`/components/${component.id}/`);
    const id = component.id.slice(component.id.indexOf('.') + 1);
    await expect(page.locator(`[data-component-preview] aeliqo-${id}`).first()).toBeAttached();
    await expect(page.getByText(/Expected result:/)).toBeVisible();
    await expect(page.locator(`[data-example-code="${id}"]`)).toContainText('registerAeliqoElements');
  }
  expect(errors).toEqual([]);
  const context = await browser.newContext({ javaScriptEnabled: false });
  const staticPage = await context.newPage();
  await staticPage.goto(new URL('/concepts/', page.url()).href);
  await expect(staticPage.getByRole('heading', { name: 'How Aeliqo works', exact: true })).toBeVisible();
  await context.close();
  const response = await page.goto('/missing-page/');
  expect(response?.status()).toBe(404);
  await expect(page.getByRole('heading', { name: 'Page not found', exact: true })).toBeVisible();
});

test('legal and support pages state the offline, reporting and commercial boundaries without default egress', async ({
  page,
}) => {
  const requests: string[] = [];
  page.on('request', (request) => requests.push(request.url()));
  await page.goto('/');
  await expect(page.locator('#analytics-consent')).toBeHidden();
  await page.goto('/legal/privacy/');
  await expect(page.getByText(/Filtering, structured intents, and evaluation run in the browser/)).toBeVisible();
  await expect(page.getByText(/asks before loading them/)).toBeVisible();
  await page.goto('/legal/license/');
  await expect(page.getByText(/does not depend on a license network service/)).toBeVisible();
  await page.goto('/legal/security/');
  await expect(page.getByRole('link', { name: 'GitHub private vulnerability reporting' })).toHaveAttribute(
    'href',
    'https://github.com/Arconath/aeliqo/security/advisories/new',
  );
  await expect(
    page.getByText(/does not publish a monitored security email address or response-time SLA/),
  ).toBeVisible();
  await page.goto('/legal/support/');
  await expect(page.getByText('does not promise a response time or commercial support agreement')).toBeVisible();
  await page.goto('/guides/data/');
  await expect(page.getByText(/local audit exporter accepts fixed event shapes/)).toBeVisible();
  expect(
    requests.some(
      (url) =>
        url.includes('/otel/v1/') || url.includes('googletagmanager.com') || url.includes('google-analytics.com'),
    ),
  ).toBe(false);
  expect(requests.every((url) => new URL(url).hostname === '127.0.0.1')).toBe(true);
});
