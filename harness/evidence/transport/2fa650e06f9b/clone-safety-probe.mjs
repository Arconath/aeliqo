import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {chromium} from '/work/node_modules/@playwright/test/index.mjs';

const encoder = new TextEncoder();
const fullBody = ('Aeliqo clone body ✓\n' + '0123456789abcdef'.repeat(64)).repeat(512); // bounded ~0.5 MiB
const ndjsonLines = Array.from({length: 256}, (_, i) => JSON.stringify({seq: i, value: 'v'.repeat(512)}) + '\n');
const ndjsonBody = ndjsonLines.join('');
const expectedFailurePaths = new Set(['/truncated', '/delayed-abort', '/slow-abort']);
const server = createServer(async (req, res) => {
  const path = new URL(req.url ?? '/', 'http://127.0.0.1').pathname;
  if (path === '/') {
    res.writeHead(200, {'content-type': 'text/html'});
    res.end('<!doctype html><meta charset=utf-8>clone probe');
    return;
  }
  if (path === '/full') {
    res.writeHead(200, {'content-type': 'application/octet-stream', 'content-length': String(Buffer.byteLength(fullBody))});
    res.end(fullBody);
    return;
  }
  if (path === '/ndjson') {
    res.writeHead(200, {'content-type': 'application/x-ndjson'});
    for (const line of ndjsonLines) {
      if (!res.write(line)) await new Promise(resolve => res.once('drain', resolve));
      await new Promise(resolve => setImmediate(resolve));
    }
    res.end();
    return;
  }
  if (path === '/truncated') {
    const body = Buffer.from('partial-body');
    res.writeHead(200, {'content-type': 'application/octet-stream', 'content-length': String(body.byteLength + 1024)});
    res.write(body);
    setImmediate(() => res.socket?.destroy());
    return;
  }
  if (path === '/delayed-abort') {
    await new Promise(resolve => setTimeout(resolve, 2000));
    if (!res.headersSent) res.writeHead(200, {'content-type': 'text/plain'});
    res.end('late');
    return;
  }
  if (path === '/slow-abort') {
    res.writeHead(200, {'content-type': 'application/octet-stream'});
    res.write('first-chunk');
    await new Promise(resolve => setTimeout(resolve, 2000));
    res.end('late-chunk');
    return;
  }
  res.writeHead(404); res.end();
});
await new Promise((resolve, reject) => {server.once('error', reject); server.listen(0, '127.0.0.1', resolve);});
const browser = await chromium.launch();
const page = await browser.newPage();
const pageErrors = [];
const consoleErrors = [];
const requestFailures = [];
const traces = [];
page.on('pageerror', e => pageErrors.push(e.message));
page.on('console', m => {if (m.type() === 'error') consoleErrors.push(m.text());});
page.on('requestfailed', r => requestFailures.push({url: r.url(), error: r.failure()?.errorText}));
const cdp = await page.context().newCDPSession(page);
await cdp.send('Network.enable');
const requestUrls = new Map();
for (const event of ['requestWillBeSent', 'responseReceived', 'loadingFinished', 'loadingFailed']) {
  cdp.on('Network.' + event, data => {
    const url = data.request?.url ?? data.response?.url;
    if (url) requestUrls.set(data.requestId, url);
    traces.push({event, requestId: data.requestId, url: url ?? requestUrls.get(data.requestId), errorText: data.errorText, canceled: data.canceled});
  });
}
await page.goto(`http://127.0.0.1:${server.address().port}/`);
const outcome = await page.evaluate(async ({port, fullLength, ndjsonLength}) => {
  const base = `http://127.0.0.1:${port}`;
  const cloneFetch = async (input, init) => {
    const response = await fetch(input, init);
    const clone = response.clone();
    void response.body?.cancel().catch(() => {});
    return clone;
  };
  const readAll = async response => new Uint8Array(await response.arrayBuffer());
  const results = {};
  const full = await readAll(await cloneFetch(base + '/full'));
  results.fullLength = full.byteLength;
  results.fullFirst = new TextDecoder().decode(full.slice(0, 32));
  const streamResponse = await cloneFetch(base + '/ndjson');
  const reader = streamResponse.body.getReader();
  const decoder = new TextDecoder();
  let streamText = '';
  let chunks = 0;
  while (true) {
    const next = await reader.read();
    if (next.done) break;
    chunks++;
    streamText += decoder.decode(next.value, {stream: true});
  }
  streamText += decoder.decode();
  results.ndjsonLines = streamText.trimEnd().split('\n').length;
  results.ndjsonChunks = chunks;
  let truncatedError;
  try { await readAll(await cloneFetch(base + '/truncated')); }
  catch (error) { truncatedError = String(error?.name ?? error); }
  results.truncatedError = truncatedError;
  const delayedController = new AbortController();
  setTimeout(() => delayedController.abort(), 20);
  let delayedError;
  try { await cloneFetch(base + '/delayed-abort', {signal: delayedController.signal}); }
  catch (error) { delayedError = String(error?.name ?? error); }
  results.delayedAbortError = delayedError;
  const slowController = new AbortController();
  let slowError;
  try {
    const response = await cloneFetch(base + '/slow-abort', {signal: slowController.signal});
    const slowReader = response.body.getReader();
    const first = await slowReader.read();
    if (first.done || new TextDecoder().decode(first.value) !== 'first-chunk') throw new Error('slow first chunk mismatch');
    slowController.abort();
    await slowReader.read();
  } catch (error) { slowError = String(error?.name ?? error); }
  results.slowAbortError = slowError;
  return results;
}, {port: server.address().port, fullLength: Buffer.byteLength(fullBody), ndjsonLength: Buffer.byteLength(ndjsonBody)});
await new Promise(resolve => setTimeout(resolve, 100));
const failurePaths = requestFailures.map(({url}) => new URL(url).pathname);
const unexpectedFailures = requestFailures.filter(({url}) => !expectedFailurePaths.has(new URL(url).pathname));
assert.equal(outcome.fullLength, Buffer.byteLength(fullBody));
assert.equal(outcome.ndjsonLines, ndjsonLines.length);
assert(outcome.ndjsonChunks > 1, `NDJSON did not stream (${outcome.ndjsonChunks} chunk)`);
assert(outcome.truncatedError, 'Truncated response unexpectedly succeeded');
assert(outcome.delayedAbortError, 'Delayed abort unexpectedly succeeded');
assert(outcome.slowAbortError, 'Mid-body abort unexpectedly succeeded');
assert.deepEqual(unexpectedFailures, []);
assert.deepEqual(pageErrors, []);
const unexpectedConsoleErrors = consoleErrors.filter(text => text !== 'Failed to load resource: net::ERR_CONTENT_LENGTH_MISMATCH');
assert.deepEqual(unexpectedConsoleErrors, []);
console.log(JSON.stringify({outcome, pageErrors, consoleErrors, requestFailures, failurePaths, unexpectedFailures, traceCount: traces.length}, null, 2));
await browser.close();
await new Promise(resolve => server.close(resolve));
