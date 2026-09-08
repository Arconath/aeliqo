import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {once} from 'node:events';
import {chromium} from '/work/node_modules/@playwright/test/index.mjs';

const stats = new Map();
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
function servePaced(path, firstChunk) {
  stats.set(path, {written: 0, closed: false, done: false, writes: 0});
  return async (req, res) => {
    const state = stats.get(path);
    res.on('close', () => {state.closed = true;});
    res.writeHead(200, {'content-type': 'application/x-ndjson'});
    if (firstChunk) res.write(firstChunk);
    const chunk = Buffer.alloc(64 * 1024, 'x');
    for (let i = 0; i < 256; i++) {
      if (res.destroyed || res.writableEnded) break;
      const ok = res.write(chunk);
      state.written += chunk.byteLength;
      state.writes++;
      if (!ok) await Promise.race([once(res, 'drain').catch(() => {}), once(res, 'close').catch(() => {})]);
      await sleep(2);
    }
    if (!res.destroyed && !res.writableEnded) res.end();
    state.done = true;
  };
}
const server = createServer(async (req, res) => {
  const path = new URL(req.url ?? '/', 'http://127.0.0.1').pathname;
  if (path === '/') {res.writeHead(200, {'content-type': 'text/html'}); res.end('clone backpressure probe'); return;}
  if (path === '/budget') return servePaced(path)(req, res);
  if (path === '/early') return servePaced(path, '{"kind":"descriptor"}\n')(req, res);
  res.writeHead(404); res.end();
});
await new Promise((resolve, reject) => {server.once('error', reject); server.listen(0, '127.0.0.1', resolve);});
const browser = await chromium.launch();
const page = await browser.newPage();
const failures = [];
const traces = [];
page.on('requestfailed', req => failures.push({path: new URL(req.url()).pathname, error: req.failure()?.errorText}));
const cdp = await page.context().newCDPSession(page);
await cdp.send('Network.enable');
for (const event of ['requestWillBeSent', 'responseReceived', 'loadingFinished', 'loadingFailed']) {
  cdp.on('Network.' + event, data => traces.push({event, id: data.requestId, url: data.request?.url ?? data.response?.url, error: data.errorText, canceled: data.canceled}));
}
await page.goto(`http://127.0.0.1:${server.address().port}/`);
const outcome = await page.evaluate(async port => {
  const cloneFetch = async path => {
    const response = await fetch(`http://127.0.0.1:${port}${path}`);
    const clone = response.clone();
    void response.body?.cancel().catch(() => {});
    return clone;
  };
  async function stopAtBudget(path, limit) {
    const response = await cloneFetch(path);
    const reader = response.body.getReader();
    let bytes = 0;
    try {
      while (true) {
        const next = await reader.read();
        if (next.done) return {bytes, stopped: false};
        bytes += next.value.byteLength;
        if (bytes > limit) {
          await reader.cancel();
          return {bytes, stopped: true};
        }
      }
    } finally {reader.releaseLock();}
  }
  async function stopAfterFirstLine(path) {
    const response = await cloneFetch(path);
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let text = '';
    try {
      while (!text.includes('\n')) {
        const next = await reader.read();
        if (next.done) throw new Error('stream ended before first line');
        text += decoder.decode(next.value, {stream: true});
      }
      await reader.cancel();
      return {firstLine: text.slice(0, text.indexOf('\n') + 1), stopped: true};
    } finally {reader.releaseLock();}
  }
  return {budget: await stopAtBudget('/budget', 128 * 1024), early: await stopAfterFirstLine('/early')};
}, server.address().port);
await sleep(1000);
const budgetStats = stats.get('/budget');
const earlyStats = stats.get('/early');
assert(outcome.budget.stopped);
assert(outcome.budget.bytes > 128 * 1024);
assert.equal(outcome.early.firstLine, '{"kind":"descriptor"}\n');
assert(outcome.early.stopped);
assert(budgetStats.closed, 'budget cancellation did not close network response');
assert(earlyStats.closed, 'early cancellation did not close network response');
assert(budgetStats.written < 2 * 1024 * 1024, `budget response drained too far: ${budgetStats.written}`);
assert(earlyStats.written < 2 * 1024 * 1024, `early response drained too far: ${earlyStats.written}`);
assert(!budgetStats.done || budgetStats.written < 2 * 1024 * 1024);
assert(!earlyStats.done || earlyStats.written < 2 * 1024 * 1024);
console.log(JSON.stringify({outcome, budgetStats, earlyStats, failures, traces}, null, 2));
await browser.close();
await new Promise(resolve => server.close(resolve));
