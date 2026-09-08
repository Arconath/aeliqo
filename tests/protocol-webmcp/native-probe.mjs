import {createServer} from 'node:http';
import {mkdtemp, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {chromium} from '@playwright/test';

const FLAG = '--enable-features=WebMCPTesting';
const TOOL_NAME = 'aeliqo_native_probe';
const executablePath = process.env.WEBMCP_CHROME_PATH ?? chromium.executablePath();
const measuredAt = new Date().toISOString();

const pageHtml = `<!doctype html>
<meta charset="utf-8">
<title>Aeliqo native WebMCP probe</title>
<p id="status">Running native WebMCP probe…</p>
<script>
(() => {
  const summary = (tools) => tools.map((tool) => ({
    name: tool?.name,
    annotations: tool?.annotations,
  }));
  const errorText = (error) => ({
    name: error?.name ?? 'Error',
    message: typeof error?.message === 'string' ? error.message : String(error),
  });
  const result = {
    origin: location.origin,
    secureContext: window.isSecureContext === true,
    modelContextPresent: false,
    registered: false,
    invoked: false,
    disposed: false,
    events: [],
  };
  window.__nativeProbe = result;
  const context = document.modelContext;
  result.modelContextPresent = context !== undefined
    && typeof context?.registerTool === 'function';
  if (!result.modelContextPresent) {
    result.done = true;
    document.querySelector('#status').textContent = 'WebMCP unavailable';
    return;
  }
  const unregister = new AbortController();
  const tool = {
    name: '${TOOL_NAME}',
    description: 'Returns a bounded local probe value without network or model access.',
    inputSchema: {
      type: 'object',
      properties: {value: {type: 'string'}},
      required: ['value'],
    },
    annotations: {
      readOnlyHint: true,
      untrustedContentHint: false,
      consequentialHint: false,
    },
    execute: async (input, options = {}) => {
      result.events.push({
        phase: 'execute',
        input: input?.value,
        signalPresent: options.signal instanceof AbortSignal,
        signalAborted: options.signal?.aborted === true,
      });
      return 'aeliqo-native:' + input.value;
    },
  };
  (async () => {
    try {
      await context.registerTool(tool, {signal: unregister.signal});
      result.registered = true;
      result.registrationSignalAborted = unregister.signal.aborted;
      if (typeof context.getTools !== 'function' || typeof context.executeTool !== 'function') {
        throw new Error('Native modelContext lacks getTools or executeTool.');
      }
      const before = await context.getTools();
      result.toolsBeforeDispose = summary(before);
      const registered = before.find((candidate) => candidate?.name === '${TOOL_NAME}');
      if (registered === undefined) throw new Error('Registered tool was absent from getTools().');
      result.invokeResult = await context.executeTool(registered, JSON.stringify({value: 'probe'}));
      result.invoked = result.invokeResult === 'aeliqo-native:probe';
      unregister.abort();
      await new Promise((resolve) => setTimeout(resolve, 25));
      const after = await context.getTools();
      result.toolsAfterDispose = summary(after);
      result.disposed = !after.some((candidate) => candidate?.name === '${TOOL_NAME}');
    } catch (error) {
      result.error = errorText(error);
    } finally {
      result.done = true;
      document.querySelector('#status').textContent = result.done ? 'Probe complete' : 'Probe failed';
    }
  })();
})();
</script>`;

function listen(server) {
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      server.off('error', reject);
      resolve(server.address());
    });
  });
}

function closeServer(server) {
  return new Promise((resolve) => server.close(() => resolve()));
}

async function runMode(mode, args, url) {
  const profile = await mkdtemp(join(tmpdir(), 'aeliqo-native-webmcp-'));
  const observation = {
    mode,
    flags: [...args],
    headless: false,
    isolatedProfile: true,
    executablePath,
    status: 'blocked',
  };
  let context;
  try {
    context = await chromium.launchPersistentContext(profile, {
      executablePath,
      headless: false,
      args: [...args],
    });
    observation.browserVersion = context.browser()?.version() ?? 'unknown';
    const page = context.pages()[0] ?? await context.newPage();
    const pageErrors = [];
    page.on('pageerror', (error) => pageErrors.push({name: error.name, message: error.message}));
    await page.goto(url, {waitUntil: 'load'});
    await page.waitForFunction(() => window.__nativeProbe?.done === true, undefined, {timeout: 10_000});
    observation.page = await page.evaluate(() => window.__nativeProbe);
    observation.pageErrors = pageErrors;
    if (observation.page?.modelContextPresent && observation.page?.registered
      && observation.page?.invoked && observation.page?.disposed) {
      observation.status = 'pass';
    }
  } catch (error) {
    observation.error = {name: error?.name ?? 'Error', message: error?.message ?? String(error)};
  } finally {
    await context?.close().catch(() => undefined);
    await rm(profile, {recursive: true, force: true});
  }
  return observation;
}

const server = createServer((_request, response) => {
  response.statusCode = 200;
  response.setHeader('content-type', 'text/html; charset=utf-8');
  response.end(pageHtml);
});
const address = await listen(server);
const url = `http://127.0.0.1:${address.port}/`;
let runs;
try {
  runs = [
    await runMode('default', [], url),
    await runMode('enable-webmcp-testing', [FLAG], url),
  ];
} finally {
  await closeServer(server);
}

const output = {
  schemaVersion: 1,
  measuredAt,
  origin: url,
  browser: {
    requested: 'Playwright-bundled Chrome for Testing 153',
    executablePath,
  },
  officialInstructions: {
    overview: 'https://developer.chrome.com/docs/ai/webmcp',
    imperativeApi: 'https://developer.chrome.com/docs/ai/webmcp/imperative-api',
    localFlag: 'chrome://flags/#enable-webmcp-testing',
    commandLineEquivalent: FLAG,
  },
  runs,
};
console.log(JSON.stringify(output, null, 2));
