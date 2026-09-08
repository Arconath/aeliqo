import {test, expect} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

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
  const updateMs = await page.locator('aeliqo-trend').evaluate(async (node) => {
    const started = performance.now();
    (node as HTMLElement & {maxMarks: number}).maxMarks = 1;
    await (node as any).updateComplete;
    return performance.now() - started;
  });
  test.info().annotations.push({type: 'cartesian-budget-update-ms', description: updateMs.toFixed(2)});
  expect(updateMs).toBeLessThan(2_000);
  await expect(page.locator('aeliqo-trend [role="status"]')).toContainText('mark budget');
  await expect(page.locator('aeliqo-trend svg')).toHaveCount(0);
  await expect(page.locator('aeliqo-trend table')).toHaveCount(1);
});

test('narrow RTL at 24px retains a keyboard scroll region and passes axe', async ({page}) => {
  await page.setViewportSize({width: 320, height: 800});
  await page.evaluate(() => {
    document.documentElement.dir = 'rtl';
    document.documentElement.style.fontSize = '24px';
  });
  const viewport = page.locator('aeliqo-trend [part="viewport"]');
  await expect(viewport).toHaveAttribute('role', 'region');
  await expect(viewport).toHaveAttribute('tabindex', '0');
  await expect(viewport).toHaveAttribute('aria-label', /Scroll to view/);
  const result = await new AxeBuilder({page}).analyze();
  expect(result.violations).toEqual([]);
});

test('keeps result warnings and precision uncertainty visible beside loaded values', async ({page}) => {
  await page.locator('aeliqo-trend').evaluate(async (node) => {
    const element = node as any;
    const result = element.context.results[0];
    element.context = {
      ...element.context,
      results: [{
        ...result,
        precision: {kind: 'approximate', method: 'bounded sample arithmetic', uncertainty: {kind: 'unquantified', reason: 'Sampling uncertainty is not quantified.'}},
        warnings: [{code: 'fixture.delayed', message: 'Source rows may be delayed.', retryable: false}],
      }],
    };
    await element.updateComplete;
  });
  await expect(page.locator('aeliqo-trend [part="note"]')).toContainText('Sampling uncertainty is not quantified.');
  await expect(page.locator('aeliqo-trend [part="warnings"]')).toContainText('Source rows may be delayed.');
  await expect(page.locator('aeliqo-trend table caption')).toContainText('Loaded approximate values');
});
