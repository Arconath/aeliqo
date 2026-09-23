import { expect, test } from '@playwright/test';

test('J3 child surfaces mount registered summary, trend and breakdown together', async ({ page }) => {
  await page.goto('/workspace/');
  await expect(page.getByRole('heading', { name: 'Engineering attendance workspace' })).toBeVisible();
  await expect(page.getByTestId('summary-status')).toHaveText('renderer-ready:data.metric');
  await expect(page.getByTestId('trend-status')).toHaveText('renderer-ready:data.trend');
  await expect(page.getByTestId('breakdown-status')).toHaveText('renderer-ready:data.table');
  await expect(page.getByTestId('summary-value')).toHaveText('2');
  await expect(page.getByTestId('trend-values')).toContainText('2026-09-01: 1');
  await expect(page.getByTestId('trend-values')).toContainText('2026-09-02: 1');
  await expect(page.getByTestId('breakdown-values')).toContainText('Ada: 1');
  await expect(page.getByTestId('breakdown-values')).toContainText('Sam: 1');
  await expect(page.getByTestId('breakdown-values')).not.toContainText('Lee');
});

test('J3 child surfaces keep other results and host focus through a failed update and resize', async ({ page }) => {
  await page.goto('/workspace/');
  await expect(page.getByTestId('breakdown-status')).toHaveText('renderer-ready:data.table');
  const draft = page.getByLabel('Workspace note');
  await draft.fill('Review tomorrow');
  await draft.focus();
  await page.getByRole('button', { name: 'Narrow workspace' }).click();
  await expect(page.getByTestId('workspace-layout')).toHaveAttribute('data-width', 'narrow');
  await expect(draft).toHaveValue('Review tomorrow');
  await draft.focus();
  await page.evaluate(() => document.querySelector<HTMLButtonElement>('#unsupported-breakdown')!.click());
  await expect(page.getByTestId('breakdown-status')).toContainText('unsupported');
  await expect(page.getByTestId('summary-status')).toHaveText('renderer-ready:data.metric');
  await expect(page.getByTestId('trend-status')).toHaveText('renderer-ready:data.trend');
  await expect(page.getByTestId('breakdown-values')).toContainText('Ada: 1');
  await expect(draft).toHaveValue('Review tomorrow');
  await expect(draft).toBeFocused();
  await page.getByRole('button', { name: 'Restore breakdown' }).click();
  await expect(page.getByTestId('breakdown-status')).toHaveText('renderer-ready:data.table');
});

for (const width of [360, 768, 1440]) {
  test(`J3 child workspace fits ${width}px without horizontal clipping`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/workspace/');
    await expect(page.getByTestId('summary-status')).toHaveText('renderer-ready:data.metric');
    await expect(page.getByTestId('trend-status')).toHaveText('renderer-ready:data.trend');
    await expect(page.getByTestId('breakdown-status')).toHaveText('renderer-ready:data.table');
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth),
    ).toBe(true);
  });
}
