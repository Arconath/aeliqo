import {test, expect} from '@playwright/test';

test.beforeEach(async ({page}) => {
  await page.goto('/tests/visualization/cartesian.html');
  await page.locator('aeliqo-trend table').waitFor();
});

test('renders six families with exact tables, histogram scope and heatmap color key', async ({page}) => {
  for (const tag of ['trend', 'bar', 'area', 'scatter', 'histogram', 'heatmap']) {
    const element = page.locator(`aeliqo-${tag}`);
    await expect(element.locator('table')).toHaveCount(1);
    await expect(element.locator('svg')).toHaveCount(1);
  }
  await expect(page.locator('aeliqo-heatmap [part="color-key"]')).toContainText('Intensity');
  await expect(page.locator('aeliqo-histogram [part="scope"]')).toContainText('Source observation coverage');
  await expect(page.locator('aeliqo-area svg path')).toHaveCount(3);
  await expect(page.locator('aeliqo-scatter').getByRole('cell', {name: '5', exact: true}).first()).toBeVisible();
});

test('selection is keyboard reachable and an over-budget graphic retains exact data', async ({page}) => {
  await page.locator('aeliqo-trend').evaluate((node) => {
    node.addEventListener('aeliqo-visualization-select', (event) => { (window as any).selection = (event as CustomEvent).detail; });
  });
  await page.locator('aeliqo-trend button').first().focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('aeliqo-trend button').first()).toHaveAttribute('aria-pressed', 'true');
  await expect.poll(() => page.evaluate(() => (window as any).selection?.source)).toBe('user');
  await page.locator('aeliqo-trend').evaluate(async (node) => {
    (node as HTMLElement & {maxMarks: number}).maxMarks = 1;
    await (node as any).updateComplete;
  });
  await expect(page.locator('aeliqo-trend [role="status"]')).toContainText('mark budget');
  await expect(page.locator('aeliqo-trend svg')).toHaveCount(0);
  await expect(page.locator('aeliqo-trend table')).toHaveCount(1);
});
