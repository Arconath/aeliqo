import {expect, test, type Page} from '@playwright/test';

type UiSnapshot = {readonly status: string; readonly regionRevision: string};
type UiWindow = Window & {
  aeliqoUiReady?: boolean;
  evaluateUiTask?: () => Promise<{readonly state: 'data-ready'}>;
  proposeUiTask?: () => Promise<{readonly state: 'bound'; readonly proposalId: string}>;
  commitUiProposal?: (proposalId: string) => Promise<{readonly state: string}>;
  completeUiTask?: () => Promise<{readonly proposalId: string}>;
  recommitUiTask?: () => Promise<void>;
  prepareUiProposal?: () => Promise<void>;
  commitHeldUiProposal?: () => Promise<{readonly state: string}>;
  malformedUiProposal?: () => Promise<{readonly state: string}>;
  startHeldUiCommit?: () => void;
  waitForUiCommitAuthorization?: () => Promise<void>;
  settleHeldUiCommit?: () => Promise<{readonly state: string}>;
  revokeUiTask?: (reason?: string) => void;
  disposeUiTask?: () => void;
  uiSnapshot?: () => UiSnapshot;
};

const pageDiagnostics = new WeakMap<object, string[]>();

test.beforeEach(({page}) => {
  const errors: string[] = [];
  pageDiagnostics.set(page, errors);
  page.on('pageerror', error => errors.push(`pageerror:${error.message}`));
  page.on('requestfailed', request => errors.push(`requestfailed:${request.url()}:${request.failure()?.errorText ?? 'unknown'}`));
});

test.afterEach(({page}) => {
  expect(pageDiagnostics.get(page)).toEqual([]);
});

async function openFixture(page: Page): Promise<void> {
  await page.goto('/tests/agent-evaluation/ui-development/browser.html');
  await expect.poll(() => page.evaluate(() => (window as UiWindow).aeliqoUiReady === true)).toBe(true);
}

async function surfaceText(page: Page): Promise<string> {
  return page.evaluate(() => {
    const region = document.querySelector('aeliqo-region') as HTMLElement | null;
    if (region === null) throw new Error('The region element is missing.');
    const shadow = region.shadowRoot;
    if (shadow === null) throw new Error('The region shadow root is missing.');
    return shadow.textContent?.trim() ?? '';
  });
}

async function snapshot(page: Page): Promise<UiSnapshot> {
  return page.evaluate(() => {
    const read = (window as UiWindow).uiSnapshot;
    if (typeof read !== 'function') throw new Error('The UI snapshot API is missing.');
    return read();
  });
}

async function evaluateUiTask(page: Page): Promise<{readonly state: 'data-ready'}> {
  return page.evaluate(async () => {
    const evaluate = (window as UiWindow).evaluateUiTask;
    if (typeof evaluate !== 'function') throw new Error('The UI evaluation API is missing.');
    return evaluate();
  });
}

async function proposeUiTask(page: Page): Promise<{readonly state: 'bound'; readonly proposalId: string}> {
  return page.evaluate(async () => {
    const propose = (window as UiWindow).proposeUiTask;
    if (typeof propose !== 'function') throw new Error('The UI proposal API is missing.');
    return propose();
  });
}

async function commitUiProposal(page: Page, proposalId: string): Promise<{readonly state: string}> {
  return page.evaluate(async id => {
    const commit = (window as UiWindow).commitUiProposal;
    if (typeof commit !== 'function') throw new Error('The UI commit API is missing.');
    return commit(id);
  }, proposalId);
}

async function completeUiTask(page: Page): Promise<void> {
  const evaluated = await evaluateUiTask(page);
  expect(evaluated.state).toBe('data-ready');
  const proposed = await proposeUiTask(page);
  expect(proposed.state).toBe('bound');
  const committed = await commitUiProposal(page, proposed.proposalId);
  expect(committed.state).toBe('renderer-ready');
}

async function focusIsOnFirstCheckbox(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const region = document.querySelector('aeliqo-region') as HTMLElement | null;
    if (region === null) throw new Error('The region element is missing.');
    const regionShadow = region.shadowRoot;
    if (regionShadow === null) throw new Error('The region shadow root is missing.');
    const table = regionShadow.querySelector('aeliqo-table[data-aeliqo-node-id="items"]') as HTMLElement | null;
    if (table === null) throw new Error('The table element is missing.');
    const tableShadow = table.shadowRoot;
    if (tableShadow === null) throw new Error('The table shadow root is missing.');
    const checkbox = tableShadow.querySelector('tbody input[type="checkbox"]') as HTMLInputElement | null;
    if (checkbox === null) throw new Error('The table checkbox is missing.');
    return document.activeElement === region && regionShadow.activeElement === table && tableShadow.activeElement === checkbox;
  });
}

test('keeps evaluation and proposal side effect free, then commits and accepts a real table selection', async ({page}) => {
  await openFixture(page);
  const initialSurface = await surfaceText(page);
  expect(initialSurface).toBe('');

  const evaluated = await evaluateUiTask(page);
  expect(evaluated.state).toBe('data-ready');
  expect(await surfaceText(page)).toBe(initialSurface);
  expect(await page.locator('aeliqo-region aeliqo-table[data-aeliqo-node-id="items"]').count()).toBe(0);

  const proposed = await proposeUiTask(page);
  expect(proposed.state).toBe('bound');
  expect(await surfaceText(page)).toBe(initialSurface);
  expect(await page.locator('aeliqo-region aeliqo-table[data-aeliqo-node-id="items"]').count()).toBe(0);

  const committed = await commitUiProposal(page, proposed.proposalId);
  expect(committed.state).toBe('renderer-ready');
  const table = page.locator('aeliqo-region aeliqo-table[data-aeliqo-node-id="items"]');
  await expect(table).toBeVisible();
  await expect(table.locator('tbody tr')).toHaveCount(2);
  const firstCheckbox = table.locator('tbody input[type="checkbox"]').first();
  await firstCheckbox.check();
  await expect(firstCheckbox).toBeChecked();
  await expect(table.locator('tbody tr').first()).toHaveAttribute('data-selected', '');
});

test('keeps the committed rows, selection, and focus when a malformed proposal is rejected', async ({page}) => {
  await openFixture(page);
  await completeUiTask(page);
  const table = page.locator('aeliqo-region aeliqo-table[data-aeliqo-node-id="items"]');
  const firstCheckbox = table.locator('tbody input[type="checkbox"]').first();
  await firstCheckbox.check();
  await firstCheckbox.focus();
  const before = await snapshot(page);

  const malformed = await page.evaluate(async () => {
    const propose = (window as UiWindow).malformedUiProposal;
    if (typeof propose !== 'function') throw new Error('The malformed proposal API is missing.');
    return propose();
  });
  expect(malformed.state).toBe('invalid');
  const after = await snapshot(page);
  expect(after.regionRevision).toBe(before.regionRevision);
  await expect(table.locator('tbody tr')).toHaveCount(2);
  await expect(firstCheckbox).toBeChecked();
  await expect.poll(() => focusIsOnFirstCheckbox(page)).toBe(true);
});

test('does not commit a proposal after a real user selection advances the region revision', async ({page}) => {
  await openFixture(page);
  await completeUiTask(page);
  await page.evaluate(async () => {
    const prepare = (window as UiWindow).prepareUiProposal;
    if (typeof prepare !== 'function') throw new Error('The held proposal API is missing.');
    await prepare();
  });
  const table = page.locator('aeliqo-region aeliqo-table[data-aeliqo-node-id="items"]');
  const beforeRevision = (await snapshot(page)).regionRevision;
  await table.locator('tbody input[type="checkbox"]').first().check();
  await expect.poll(() => snapshot(page).then(value => value.regionRevision)).not.toBe(beforeRevision);
  const stale = await page.evaluate(async () => {
    const commit = (window as UiWindow).commitHeldUiProposal;
    if (typeof commit !== 'function') throw new Error('The held commit API is missing.');
    return commit();
  });
  expect(stale.state).toBe('stale');
  await expect(table.locator('tbody input[type="checkbox"]').first()).toBeChecked();
});

test('revocation clears an existing surface and late held work cannot restore it', async ({page}) => {
  await openFixture(page);
  await completeUiTask(page);
  const table = page.locator('aeliqo-region aeliqo-table[data-aeliqo-node-id="items"]');
  const firstCheckbox = table.locator('tbody input[type="checkbox"]').first();
  await firstCheckbox.check();
  await firstCheckbox.focus();
  await page.evaluate(async () => {
    const prepare = (window as UiWindow).prepareUiProposal;
    if (typeof prepare !== 'function') throw new Error('The held proposal API is missing.');
    await prepare();
    const start = (window as UiWindow).startHeldUiCommit;
    if (typeof start !== 'function') throw new Error('The held commit start API is missing.');
    start();
    const wait = (window as UiWindow).waitForUiCommitAuthorization;
    if (typeof wait !== 'function') throw new Error('The commit authorization wait API is missing.');
    await wait();
  });
  await page.evaluate(() => {
    const revoke = (window as UiWindow).revokeUiTask;
    if (typeof revoke !== 'function') throw new Error('The UI revocation API is missing.');
    revoke('browser test revocation');
  });
  const late = await page.evaluate(async () => {
    const settle = (window as UiWindow).settleHeldUiCommit;
    if (typeof settle !== 'function') throw new Error('The held commit settle API is missing.');
    return settle();
  });
  expect(late.state).toBe('partial');
  await expect.poll(() => surfaceText(page)).toBe('');
  await expect.poll(() => snapshot(page).then(value => value.status)).toBe('revoked');
  await expect.poll(() => surfaceText(page)).toBe('');
  await page.evaluate(() => {
    const dispose = (window as UiWindow).disposeUiTask;
    if (typeof dispose !== 'function') throw new Error('The UI disposal API is missing.');
    dispose();
  });
  await expect.poll(() => snapshot(page).then(value => value.status)).toBe('disposed');
  await expect.poll(() => surfaceText(page)).toBe('');
});
