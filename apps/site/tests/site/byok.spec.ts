import { expect, test, type Page, type Route } from '@playwright/test';

const endpoint = 'https://api.deepseek.com/chat/completions';
const fakeKey = 'test-provider-key-placeholder';
const renderIntent = {
  version: '1',
  id: 'byok-people-browse',
  kind: 'browse',
  resource: 'people',
  fields: ['name', 'team', 'location'],
};

interface FetchProbe {
  readonly mode: RequestMode | undefined;
  readonly credentials: RequestCredentials | undefined;
  readonly cache: RequestCache | undefined;
  readonly redirect: RequestRedirect | undefined;
  readonly referrerPolicy: ReferrerPolicy | undefined;
  readonly signal: AbortSignal | null | undefined;
}

async function prepareDeepSeek(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Connect AI' }).click();
  await page.locator('#pg-connection-kind').selectOption('deepseek');
  await expect(page.locator('#pg-deepseek-consent')).not.toBeChecked();
  await expect(page.locator('#pg-deepseek-connect')).toBeDisabled();
  await page.locator('#pg-deepseek-key').fill(fakeKey);
  await expect(page.locator('#pg-deepseek-connect')).toBeDisabled();
  await page.locator('#pg-deepseek-consent').check();
  await expect(page.locator('#pg-deepseek-connect')).toBeEnabled();
}

async function connectDeepSeek(page: Page): Promise<void> {
  await page.locator('#pg-deepseek-connect').click();
  await expect(page.locator('#pg-connection-label')).toContainText('DeepSeek is configured');
  await expect(page.locator('#pg-connection-dot')).toHaveAttribute('data-state', 'configured');
  await expect(page.locator('#pg-deepseek-key')).toHaveValue('');
  await expect(page.locator('#pg-prompt')).toBeEnabled();
}

function completion(tool: { readonly name: string; readonly id: string; readonly input: object }) {
  return {
    id: `chatcmpl-${tool.id}`,
    object: 'chat.completion',
    model: 'deepseek-flash',
    choices: [
      {
        index: 0,
        message: {
          role: 'assistant',
          content: null,
          tool_calls: [
            {
              id: tool.id,
              type: 'function',
              function: { name: tool.name, arguments: JSON.stringify(tool.input) },
            },
          ],
        },
        finish_reason: 'tool_calls',
      },
    ],
    usage: { prompt_tokens: 100, completion_tokens: 20, total_tokens: 120 },
  };
}

async function fulfillCorsPreflight(route: Route, origin: string): Promise<boolean> {
  if (route.request().method() !== 'OPTIONS') return false;
  const requestedHeaders = route.request().headers()['access-control-request-headers'] ?? 'authorization,content-type';
  await route.fulfill({
    status: 204,
    headers: {
      'access-control-allow-origin': origin,
      'access-control-allow-methods': 'POST, OPTIONS',
      'access-control-allow-headers': requestedHeaders,
    },
  });
  return true;
}

async function installFetchProbe(page: Page): Promise<void> {
  await page.addInitScript((target) => {
    const originalFetch = window.fetch.bind(window);
    Object.defineProperty(window, '__deepseekFetchProbe', { value: [], configurable: false });
    window.fetch = (input, init) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      if (url === target) {
        const probe = (window as unknown as { __deepseekFetchProbe: FetchProbe[] }).__deepseekFetchProbe;
        probe.push({
          mode: init?.mode,
          credentials: init?.credentials,
          cache: init?.cache,
          redirect: init?.redirect,
          referrerPolicy: init?.referrerPolicy,
          signal: init?.signal,
        });
      }
      return originalFetch(input, init);
    };
  }, endpoint);
}

test('manual intent stays network-free before and after provider disconnect', async ({ page }) => {
  const providerRequests: { readonly headers: Record<string, string>; readonly body: Record<string, unknown> }[] = [];
  const leakedRequests: string[] = [];
  const browserRequests: string[] = [];
  await installFetchProbe(page);
  page.on('request', (request) => browserRequests.push(request.url()));
  page.on('request', (request) => {
    if (request.url() === endpoint) return;
    const contents = `${request.url()} ${request.postData() ?? ''} ${request.headers()['authorization'] ?? ''}`;
    if (contents.includes(fakeKey)) leakedRequests.push(request.url());
  });
  await page.goto('/playground/');
  await expect(page.locator('#pg-receipt-state')).toHaveText('renderer-ready');
  await page.locator('#pg-manual summary').click();
  await page.locator('#pg-manual-step').selectOption('people-detail');
  await page.getByRole('button', { name: 'Apply intent' }).click();
  await expect(page.locator('aeliqo-detail')).toContainText('Ada Chen');
  await page.locator('#pg-manual summary').click();
  const pageOrigin = new URL(page.url()).origin;
  const noAgentProviderRequests = browserRequests.filter((url) => {
    const requestUrl = new URL(url);
    return requestUrl.origin !== pageOrigin || requestUrl.pathname.startsWith('/api/');
  });
  expect(noAgentProviderRequests).toEqual([]);

  await prepareDeepSeek(page);
  await expect(page.locator('#pg-deepseek-key')).toHaveAttribute('type', 'password');
  await expect(page.locator('#pg-deepseek-key')).toHaveAttribute('autocomplete', 'off');
  await page.route(endpoint, async (route) => {
    if (await fulfillCorsPreflight(route, new URL(page.url()).origin)) return;
    const request = route.request();
    const body = request.postDataJSON() as {
      readonly model: string;
      readonly max_tokens: number;
      readonly messages: readonly { readonly role: string; readonly content?: string | null }[];
      readonly tools: readonly { readonly function: { readonly name: string } }[];
    };
    providerRequests.push({ headers: request.headers(), body: body as unknown as Record<string, unknown> });
    if (providerRequests.length === 1) {
      expect(body.model).toBe('deepseek-flash');
      expect(body.max_tokens).toBeLessThanOrEqual(1_024);
      expect(body.tools.map((tool) => tool.function.name)).toContain('aeliqo_context');
      expect(body.messages.map((message) => message.content ?? '').join('\n')).toContain('People (people)');
      expect(body.messages.map((message) => message.content ?? '').join('\n')).toContain('Browse employees');
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: { 'access-control-allow-origin': new URL(page.url()).origin },
        body: JSON.stringify(completion({ name: 'aeliqo_context', id: 'context-1', input: {} })),
      });
      return;
    }
    expect(providerRequests).toHaveLength(2);
    expect(body.messages.find((message) => message.role === 'tool')?.content).toContain('activeResource');
    expect(body.messages.find((message) => message.role === 'tool')?.content).toContain('people');
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: { 'access-control-allow-origin': new URL(page.url()).origin },
      body: JSON.stringify(completion({ name: 'aeliqo_render', id: 'render-1', input: renderIntent })),
    });
  });
  await connectDeepSeek(page);
  await expect(page.locator('#pg-deepseek-connect')).toBeHidden();
  await page.locator('#pg-prompt').fill('Browse people by team and location');
  await page.locator('#pg-send').click();

  await expect(page.locator('aeliqo-table')).toContainText('Ada Chen');
  await expect(page.locator('#pg-connect-status')).toContainText('renderer confirmed the view');
  await expect(page.locator('#pg-connection-label')).toContainText('DeepSeek verified');
  await expect(page.locator('#pg-connection-dot')).toHaveAttribute('data-state', 'verified');
  await expect(page.locator('#pg-model-calls')).toHaveText('2');
  expect(providerRequests.map(({ headers }) => headers.authorization)).toEqual([
    `Bearer ${fakeKey}`,
    `Bearer ${fakeKey}`,
  ]);
  expect(providerRequests.every(({ body }) => body.model === 'deepseek-flash')).toBe(true);
  expect(JSON.stringify(providerRequests)).not.toContain('Ada Chen');
  expect(leakedRequests).toEqual([]);

  const probe = await page.evaluate(() => {
    const entries = (window as unknown as { __deepseekFetchProbe: FetchProbe[] }).__deepseekFetchProbe;
    return entries.map(({ mode, credentials, cache, redirect, referrerPolicy }) => ({
      mode,
      credentials,
      cache,
      redirect,
      referrerPolicy,
    }));
  });
  expect(probe).toEqual([
    { mode: 'cors', credentials: 'omit', cache: 'no-store', redirect: 'error', referrerPolicy: 'no-referrer' },
    { mode: 'cors', credentials: 'omit', cache: 'no-store', redirect: 'error', referrerPolicy: 'no-referrer' },
  ]);
  const persisted = await page.evaluate((key) => {
    const values = [
      ...Object.values(localStorage),
      ...Object.values(sessionStorage),
      document.cookie,
      window.location.href,
    ];
    return values.some((value) => value.includes(key));
  }, fakeKey);
  expect(persisted).toBe(false);

  await page.locator('#pg-deepseek-disconnect').click();
  await expect(page.locator('#pg-connection-dot')).toHaveAttribute('data-state', 'disconnected');
  await expect(page.locator('#pg-deepseek-key')).toHaveValue('');
  await expect(page.locator('#pg-deepseek-consent')).not.toBeChecked();
  await expect(page.locator('#pg-prompt')).toBeDisabled();
  await expect(page.locator('#pg-send')).toBeDisabled();

  const requestsAtDisconnect = browserRequests.length;
  await page.getByRole('button', { name: 'Without AI' }).click();
  await page.locator('#pg-manual summary').click();
  await page.locator('#pg-manual-step').selectOption('people-detail');
  await page.getByRole('button', { name: 'Apply intent' }).click();
  await expect(page.locator('aeliqo-detail')).toContainText('Ada Chen');
  await expect(page.locator('#pg-receipt-state')).toHaveText('renderer-ready');
  expect(providerRequests).toHaveLength(2);
  expect(browserRequests.slice(requestsAtDisconnect)).toEqual([]);
});

test('reset clears the key and requires a fresh opt-in', async ({ page }) => {
  await page.goto('/playground/');
  await prepareDeepSeek(page);
  await connectDeepSeek(page);
  await page.getByRole('button', { name: 'Reset playground' }).click();
  await expect(page.locator('#pg-deepseek-key')).toHaveValue('');
  await expect(page.locator('#pg-deepseek-consent')).not.toBeChecked();
  await expect(page.locator('#pg-prompt')).toBeDisabled();
  await page.getByRole('button', { name: 'Connect AI' }).click();
  await page.locator('#pg-connection-kind').selectOption('deepseek');
  await expect(page.locator('#pg-deepseek-connect')).toBeDisabled();
});

test('leaving DeepSeek selection clears an unsubmitted key and consent', async ({ page }) => {
  await page.goto('/playground/');
  await prepareDeepSeek(page);
  await page.locator('#pg-connection-kind').selectOption('detect');
  await expect(page.locator('#pg-deepseek-key')).toHaveValue('');
  await expect(page.locator('#pg-deepseek-consent')).not.toBeChecked();
  await page.locator('#pg-connection-kind').selectOption('deepseek');
  await expect(page.locator('#pg-deepseek-connect')).toBeDisabled();
});

test('pagehide aborts an in-flight provider request and closes the browser connection', async ({ page }) => {
  let started!: () => void;
  let release!: () => void;
  const providerStarted = new Promise<void>((resolve) => {
    started = resolve;
  });
  const releaseRoute = new Promise<void>((resolve) => {
    release = resolve;
  });
  await installFetchProbe(page);
  await page.goto('/playground/');
  await prepareDeepSeek(page);
  await page.route(endpoint, async (route) => {
    if (await fulfillCorsPreflight(route, new URL(page.url()).origin)) return;
    started();
    await releaseRoute;
    try {
      await route.abort();
    } catch {
      // The browser may already have cancelled the intercepted request.
    }
  });
  await connectDeepSeek(page);
  await page.locator('#pg-prompt').fill('Browse people');
  await page.locator('#pg-send').click();
  await providerStarted;
  await page.evaluate(() => window.dispatchEvent(new Event('pagehide')));
  const aborted = await page.evaluate(() => {
    const entries = (window as unknown as { __deepseekFetchProbe: FetchProbe[] }).__deepseekFetchProbe;
    return entries.at(-1)?.signal?.aborted ?? false;
  });
  expect(aborted).toBe(true);
  release();
});

test('changing scenarios cancels an in-flight request without reporting provider verification', async ({ page }) => {
  let started!: () => void;
  let release!: () => void;
  const providerStarted = new Promise<void>((resolve) => {
    started = resolve;
  });
  const releaseRoute = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.goto('/playground/');
  await prepareDeepSeek(page);
  await page.route(endpoint, async (route) => {
    if (await fulfillCorsPreflight(route, new URL(page.url()).origin)) return;
    started();
    await releaseRoute;
    try {
      await route.abort();
    } catch {
      // The request may already have been cancelled by the scenario change.
    }
  });
  await connectDeepSeek(page);
  await page.locator('#pg-prompt').fill('Browse people');
  await page.locator('#pg-send').click();
  await providerStarted;
  try {
    await page.locator('#pg-scenario').selectOption('products');
    await expect(page.locator('#pg-connect-status')).toContainText('request was cancelled');
    await expect(page.locator('#pg-connection-label')).toContainText('DeepSeek is configured');
    await expect(page.locator('#pg-connection-label')).not.toContainText('verified');
    await expect(page.locator('#pg-connection-dot')).toHaveAttribute('data-state', 'configured');
    await expect(page.locator('#pg-model-calls')).toHaveText('0');
  } finally {
    release();
  }
});

test('a restored page clears a replacement connection on its next pagehide', async ({ page }) => {
  let started!: () => void;
  let release!: () => void;
  const providerStarted = new Promise<void>((resolve) => {
    started = resolve;
  });
  const releaseRoute = new Promise<void>((resolve) => {
    release = resolve;
  });
  await installFetchProbe(page);
  await page.goto('/playground/');
  await prepareDeepSeek(page);
  await connectDeepSeek(page);
  await page.evaluate(() => {
    window.dispatchEvent(new PageTransitionEvent('pagehide', { persisted: true }));
    window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }));
  });
  await expect(page.locator('#pg-prompt')).toBeDisabled();
  await expect(page.locator('#pg-send')).toBeDisabled();
  await expect(page.locator('#pg-deepseek-disconnect')).toBeHidden();
  await expect(page.locator('#pg-deepseek-consent')).not.toBeChecked();
  await expect(page.locator('#pg-connect-status')).toContainText('Reconnect to continue');
  await page.getByRole('button', { name: 'Reset playground' }).click();
  await page.getByRole('button', { name: 'Without AI' }).click();
  await page.locator('#pg-steps [data-step]').first().click();
  await expect(page.locator('#pg-receipt-state')).toHaveText('renderer-ready');
  await prepareDeepSeek(page);
  await page.route(endpoint, async (route) => {
    if (await fulfillCorsPreflight(route, new URL(page.url()).origin)) return;
    started();
    await releaseRoute;
    try {
      await route.abort();
    } catch {
      // The browser may already have cancelled the intercepted request.
    }
  });
  await connectDeepSeek(page);
  await page.locator('#pg-prompt').fill('Browse people');
  await page.locator('#pg-send').click();
  await providerStarted;
  try {
    await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pagehide', { persisted: true })));
    const aborted = await page.evaluate(() => {
      const entries = (window as unknown as { __deepseekFetchProbe: FetchProbe[] }).__deepseekFetchProbe;
      return entries.at(-1)?.signal?.aborted ?? false;
    });
    expect(aborted).toBe(true);
  } finally {
    release();
  }
});

test('provider failures are sanitized before they reach the Playground', async ({ page }) => {
  let providerAttempt = 0;
  await page.goto('/playground/');
  await prepareDeepSeek(page);
  await page.route(endpoint, async (route) => {
    if (await fulfillCorsPreflight(route, new URL(page.url()).origin)) return;
    providerAttempt += 1;
    const headers = { 'access-control-allow-origin': new URL(page.url()).origin };
    if (providerAttempt === 1) {
      await route.fulfill({
        status: 401,
        contentType: 'application/json',
        headers,
        body: JSON.stringify({ error: `invalid key ${fakeKey}` }),
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers,
      body: JSON.stringify(
        providerAttempt === 2
          ? completion({ name: 'aeliqo_context', id: 'recovery-context', input: {} })
          : completion({ name: 'aeliqo_render', id: 'recovery-render', input: renderIntent }),
      ),
    });
  });
  await connectDeepSeek(page);
  await page.locator('#pg-prompt').fill('Browse people');
  await page.locator('#pg-send').click();
  await expect(page.locator('#pg-connect-status')).toContainText('stopped as failed');
  await expect(page.locator('#pg-connection-dot')).toHaveAttribute('data-state', 'failed');
  await expect(page.locator('#pg-connected')).not.toContainText(fakeKey);
  await expect(page.locator('#pg-error')).not.toContainText(fakeKey);

  await page.locator('#pg-send').click();
  await expect(page.locator('aeliqo-table')).toContainText('Ada Chen');
  await expect(page.locator('#pg-connection-label')).toContainText('DeepSeek verified');
  await expect(page.locator('#pg-connection-dot')).toHaveAttribute('data-state', 'verified');
  await expect(page.locator('#pg-model-calls')).toHaveText('2');
  expect(providerAttempt).toBe(3);
});
