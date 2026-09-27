import { test, expect } from '@playwright/test';
type Fixture = {
  snapshot(): { runtime: unknown; plan: unknown; renders: number; sameInput: boolean };
  render(mode: string): Promise<{ status: string; diagnostics: readonly { code: string }[] }>;
  dispose(): void;
};
type Host = typeof window & { transactionFixture: Fixture };

for (const mode of ['unsupported', 'throw'])
  test(`${mode} replacement retains canonical task, DOM and focused input`, async ({ page }) => {
    await page.goto('/tests/runtime-presentation/browser/app-transaction.html');
    await expect(page.locator('#status')).toHaveText('renderer-ready');
    const input = page.getByRole('textbox', { name: 'Host draft' });
    await input.fill('Unsaved');
    await input.focus();
    const before = await page.evaluate(() => (window as Host).transactionFixture.snapshot());
    const result = await page.evaluate((mode) => (window as Host).transactionFixture.render(mode), mode);
    expect(result.status, JSON.stringify(result)).not.toBe('renderer-ready');
    if (mode === 'throw')
      expect(
        result.diagnostics.some((item) => item.code === 'web.app.renderer'),
        JSON.stringify(result),
      ).toBe(true);
    const after = await page.evaluate(() => (window as Host).transactionFixture.snapshot());
    if (mode === 'throw') expect(after.renders).toBeGreaterThan(before.renders);
    expect(after.runtime).toEqual(before.runtime);
    expect(after.plan).toEqual(before.plan);
    expect(after.sameInput).toBe(true);
    await expect(input).toHaveValue('Unsaved');
    await expect(input).toBeFocused();
    await expect(page.locator('aeliqo-region')).toContainText('Ada');
  });

test('host revocation during renderer apply cannot publish or restore private DOM', async ({ page }) => {
  await page.goto('/tests/runtime-presentation/browser/app-transaction.html');
  await expect(page.locator('#status')).toHaveText('renderer-ready');
  const result = await page.evaluate(() => (window as Host).transactionFixture.render('revoke'));
  expect(result.status, JSON.stringify(result)).not.toBe('renderer-ready');
  await expect(page.locator('aeliqo-region'), JSON.stringify(result)).not.toContainText('Ada');
  await expect(page.getByRole('textbox', { name: 'Host draft' })).toHaveCount(0);
});
