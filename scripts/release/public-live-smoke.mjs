import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';

import { chromium } from '@playwright/test';
const expectedSha = process.argv[2];
if (!/^[a-f0-9]{40}$/u.test(expectedSha ?? '')) throw new Error('Expected full release SHA.');
const apexOrigin = process.env.AELIQO_APEX_ORIGIN ?? 'https://aeliqo.com';
const docsOrigin = process.env.AELIQO_DOCS_ORIGIN ?? 'https://docs.aeliqo.com';
const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();
const errors = [];
page.on('pageerror', (error) => errors.push(error.message));
const checks = [];
const evidence = {};

async function visit(url, status = 200) {
  const response = await page.goto(url, { waitUntil: 'domcontentloaded' });
  assert.equal(response?.status(), status, `${url} returned ${response?.status()}`);
  checks.push({ url, status });
  return response;
}

try {
  for (const origin of [apexOrigin, docsOrigin]) {
    const version = await visit(`${origin}/version`);
    const identity = await version.json();
    assert.equal(identity.sdkRevision, expectedSha);
    assert.equal(identity.siteRevision, expectedSha);
    assert.equal(identity.sdkVersion, '0.5.0');
  }
  await visit(`${apexOrigin}/healthz`);
  await visit(`${apexOrigin}/readyz`);
  await visit(`${apexOrigin}/`);
  assert((await page.locator('h1').count()) > 0);
  await visit(`${docsOrigin}/components/data.table/`);
  evidence.componentSidebarLinks = await page
    .locator('.docs-sidebar nav a[href^="/components/"]:not([href="/components/"])')
    .count();
  assert.equal(evidence.componentSidebarLinks, 71);
  await page.waitForFunction(() => !document.querySelector('.search-trigger')?.hasAttribute('disabled'));
  await page.keyboard.press('Control+k');
  await page.locator('.docs-search-field').fill('table');
  await page.locator('.search-results a[href="/components/data.table/"]').first().waitFor();
  evidence.search = { query: 'table', resultHref: '/components/data.table/', shortcut: 'Control+k' };
  await page.keyboard.press('Escape');
  await visit(`${docsOrigin}/playground/`);
  await page.waitForFunction(() => document.querySelector('#pg-receipt-state')?.textContent === 'renderer-ready');
  await page.locator('[data-journey="jakarta"]').click();
  await page.waitForFunction(() => document.querySelector('#pg-receipt-state')?.textContent === 'renderer-ready');
  assert.match(await page.locator('#pg-committed-filter').textContent(), /Jakarta/u);
  assert.equal(await page.locator('aeliqo-table').getByText('Ada Chen').count(), 1);
  assert.equal(await page.locator('aeliqo-table').getByText('Sam Rivera').count(), 0);
  evidence.peopleJakarta = {
    committedFilter: (await page.locator('#pg-committed-filter').textContent()).trim(),
    adaRows: await page.locator('aeliqo-table').getByText('Ada Chen').count(),
    samRows: await page.locator('aeliqo-table').getByText('Sam Rivera').count(),
  };
  assert.equal(await page.locator('#pg-export').isEnabled(), false);
  for (const [journey, selector] of [
    ['attendance', '[data-testid="attendance-status"]'],
    ['workspace', '[data-testid="goal-status"]'],
  ]) {
    await page.locator(`[data-journey="${journey}"]`).click();
    await page.waitForFunction(
      (target) => document.querySelector(target)?.textContent?.includes('renderer-ready'),
      selector,
    );
    assert.equal(await page.locator('#pg-export').isEnabled(), false);
  }
  await page.locator('[data-journey="attendance"]').click();
  await page.waitForFunction(() =>
    document.querySelector('[data-testid="attendance-status"]')?.textContent?.includes('renderer-ready'),
  );
  assert.match(await page.locator('[data-testid="period"]').textContent(), /Asia\/Jakarta/u);
  assert.match(await page.locator('[data-testid="daily-values"]').textContent(), /2026-09-02: 0\.5/u);
  evidence.attendance = {
    period: (await page.locator('[data-testid="period"]').textContent()).trim(),
    dailyValues: await page.locator('[data-testid="daily-values"] li').allTextContents(),
  };
  assert.deepEqual(evidence.attendance.dailyValues, ['2026-09-01: 1', '2026-09-02: 0.5', '2026-09-03: 1']);
  await page.getByRole('button', { name: 'Compare attendance metrics' }).click();
  assert.match(await page.locator('#pg-journey-result').textContent(), /Needs a choice/u);
  evidence.attendance.clarification = (await page.locator('#pg-journey-result').textContent()).trim();
  await page.locator('[data-journey="workspace"]').click();
  await page.waitForFunction(() =>
    document.querySelector('[data-testid="goal-status"]')?.textContent?.includes('renderer-ready'),
  );
  assert.equal(
    await page.locator('[data-testid="goal-workspace"]').getAttribute('data-needs'),
    'summary,trend,breakdown',
  );
  await page.getByRole('button', { name: 'Request anomaly' }).click();
  assert.match(await page.locator('[data-testid="goal-status"]').textContent(), /unsupported:intent\.unknown-custom/u);
  assert((await page.locator('[data-testid="goal-workspace"]').getByText('Ada').count()) > 0);
  evidence.workspace = {
    needs: await page.locator('[data-testid="goal-workspace"]').getAttribute('data-needs'),
    unsupported: (await page.locator('[data-testid="goal-status"]').textContent()).trim(),
    priorAdaRetained: (await page.locator('[data-testid="goal-workspace"]').getByText('Ada').count()) > 0,
  };
  assert.equal(await page.locator('#pg-model-calls').textContent(), '0');
  await page.locator('#pg-scenario').selectOption('products');
  assert.equal(await page.locator('#pg-export').isEnabled(), true);
  const downloadPromise = page.waitForEvent('download');
  await page.locator('#pg-export').click();
  const download = await downloadPromise;
  assert.match(download.suggestedFilename(), /\.zip$/u);
  const archive = await readFile(await download.path());
  assert.equal(archive.subarray(0, 4).toString('hex'), '504b0304');
  assert(archive.length > 1024);
  const packageJson = JSON.parse(
    execFileSync('unzip', ['-p', await download.path(), 'package.json'], { encoding: 'utf8' }),
  );
  for (const name of ['@aeliqo/core', '@aeliqo/runtime', '@aeliqo/web']) {
    assert.equal(packageJson.dependencies[name], '0.5.0');
  }
  evidence.exportPackageDependencies = packageJson.dependencies;
  assert.deepEqual(errors, []);
  console.log(
    JSON.stringify({
      status: 'passed',
      expectedSha,
      checks,
      evidence,
      noAiJourneys: ['people', 'attendance', 'workspace'],
      modelCalls: 0,
      export: { filename: download.suggestedFilename(), bytes: archive.length, pinnedVersion: '0.5.0' },
    }),
  );
} finally {
  await browser.close();
}
