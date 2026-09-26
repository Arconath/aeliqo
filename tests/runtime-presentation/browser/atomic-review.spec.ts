import { test, expect } from '@playwright/test';

type Fixture = {
  snapshot(): {
    runtime: unknown;
    plan: unknown;
    renders: number;
    sameInput: boolean;
    liveInteraction: unknown;
    canonicalInteraction: unknown;
    initialInteractions: { live: unknown; canonical: unknown };
  };
  render(mode: string): Promise<{ status: string; diagnostics?: unknown }>;
  emitSelection(): void;
  directThrow(kind?: string): { rolledBack: boolean; error?: string };
};
type Host = typeof window & { transactionFixture: Fixture };

test.beforeEach(async ({ page }) => {
  await page.goto('/tests/runtime-presentation/browser/atomic-review.html');
  await expect(page.locator('#status')).toHaveText('renderer-ready');
});

test('nested keyed host renderer failure restores prior DOM without reentering failed callbacks', async ({ page }) => {
  const input = page.getByRole('textbox', { name: 'Host draft' });
  await input.fill('Unsaved nested draft');
  await input.focus();
  const before = await page.evaluate(() => (window as Host).transactionFixture.snapshot());
  const receipt = await page.evaluate(() => (window as Host).transactionFixture.directThrow());
  expect(receipt.rolledBack, JSON.stringify(receipt)).toBe(true);
  const after = await page.evaluate(() => (window as Host).transactionFixture.snapshot());
  expect(after.runtime).toEqual(before.runtime);
  expect(after.plan).toEqual(before.plan);
  expect(after.sameInput).toBe(true);
  await expect(input).toHaveValue('Unsaved nested draft');
  await expect(input).toBeFocused();
});

test('semantic interaction reentered during synchronous publication cannot diverge from staged state', async ({
  page,
}) => {
  await page.goto('/tests/runtime-presentation/browser/atomic-review.html?mode=emit');
  await expect(page.locator('#status')).toHaveText('renderer-ready');
  const after = await page.evaluate(() => (window as Host).transactionFixture.snapshot());
  expect(after.initialInteractions.live ?? { version: '1', values: [], drafts: [] }).toEqual(
    after.initialInteractions.canonical,
  );
});

test('semantic interaction after synchronous publication remains available', async ({ page }) => {
  await page.evaluate(() => (window as Host).transactionFixture.emitSelection());
  const after = await page.evaluate(() => (window as Host).transactionFixture.snapshot());
  expect(after.liveInteraction).toMatchObject({ values: [{ portId: 'selection', payload: { kind: 'selection' } }] });
});

test('deterministic host-owned repeat callback failure restores the prior template', async ({ page }) => {
  const input = page.getByRole('textbox', { name: 'Host draft' });
  await input.fill('Nested host directive draft');
  const receipt = await page.evaluate(() =>
    (window as Host).transactionFixture.directThrow('captured-directive-throw'),
  );
  expect(receipt.rolledBack, JSON.stringify(receipt)).toBe(true);
  await expect(input).toHaveValue('Nested host directive draft');
});

// This intentionally violates the replayable host-template contract. Keep the limitation executable.
test('impure host-owned repeat callback can also fail during raw rollback', async ({ page }) => {
  const receipt = await page.evaluate(() => (window as Host).transactionFixture.directThrow('directive-throw'));
  expect(receipt).toEqual({ rolledBack: false, error: 'Error: synthetic nested directive failure' });
});

test('app contains an impure rollback failure without publishing the candidate', async ({ page }) => {
  await page.goto('/tests/runtime-presentation/browser/atomic-review.html?wrap=false');
  await expect(page.locator('#status')).toHaveText('renderer-ready');
  const before = await page.evaluate(() => (window as Host).transactionFixture.snapshot());
  const receipt = await page.evaluate(() => (window as Host).transactionFixture.render('directive-throw'));
  expect(receipt.status, JSON.stringify(receipt)).toBe('failed');
  const after = await page.evaluate(() => (window as Host).transactionFixture.snapshot());
  expect(after.runtime).toEqual(before.runtime);
  await expect(page.getByRole('textbox', { name: 'Host draft' })).toHaveCount(0);
});

test('semantic interaction reentered during rollback cannot change the prior live or canonical state', async ({
  page,
}) => {
  await page.goto('/tests/runtime-presentation/browser/atomic-review.html?wrap=false');
  await expect(page.locator('#status')).toHaveText('renderer-ready');
  const { before, receipt, after } = await page.evaluate(async () => {
    const fixture = (window as Host).transactionFixture;
    const before = fixture.snapshot();
    const receipt = await fixture.render('emit-rollback');
    return { before, receipt, after: fixture.snapshot() };
  });
  expect(receipt.status).toBe('failed');
  expect(after.runtime).toEqual(before.runtime);
  expect(after.liveInteraction).toEqual(before.liveInteraction);
  expect(after.sameInput).toBe(true);
});
