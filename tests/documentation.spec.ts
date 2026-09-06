import { expect, test } from '@playwright/test';

test('documentation is searchable and keeps live partial-state examples readable across widths', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('tab', { name: 'Documentation', exact: true }).click();
  await expect(page.getByRole('article', { name: 'Start here' })).toBeVisible();
  await page.getByRole('searchbox').fill('money');
  await page.getByRole('link', { name: /Data that keeps/ }).click();
  await expect(page.getByText('89.2%', { exact: true })).toBeVisible();
  await expect(page.getByText('Loaded page only; results are not global.', { exact: true })).toBeVisible();
  for (const width of [360, 768, 1280]) {
    await page.setViewportSize({ width, height: 1000 });
    await expect(page.locator('.docs-article')).toBeVisible();
    const overflow = await page.locator('.docs-shell').evaluate(element => element.scrollWidth > element.clientWidth + 1);
    expect(overflow, `documentation shell overflow at ${width}px`).toBe(false);
    await page.screenshot({ path: `artifacts/docs-${width}.png`, fullPage: true });
  }
});
