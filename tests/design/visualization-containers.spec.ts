import { expect, test, type Locator } from '@playwright/test';

for (const direction of ['ltr', 'rtl']) {
  for (const family of ['hierarchy', 'temporal']) {
    test(`${family} stays readable in narrow ${direction} containers`, async ({ page, browserName }, info) => {
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.goto(`/tests/visualization/${family === 'hierarchy' ? 'index' : 'temporal'}.html`);
      const tags = family === 'hierarchy' ? ['tree', 'treemap', 'relationship'] : ['timeline', 'calendar-grid'];
      for (const width of [240, 320, 480]) {
        for (const tag of tags) {
          const host = page.locator(`aeliqo-${tag}`);
          await host.evaluate(
            (element, settings) => {
              element.setAttribute('dir', settings.direction);
              element.setAttribute('data-aeliqo-theme', settings.direction === 'rtl' ? 'dark' : 'light');
              (element as HTMLElement).style.width = `${settings.width}px`;
            },
            { direction, width },
          );
          await expect(host.locator('td').first()).toHaveCSS('display', 'grid');
          const viewport = host.locator('[part="viewport"]');
          const svg = viewport.locator('svg');
          if (await svg.count()) {
            const dimensions = await svg.evaluate((element) => ({
              displayed: element.getBoundingClientRect().width,
              intrinsic: Number(element.getAttribute('width')),
            }));
            expect(dimensions.displayed).toBeGreaterThanOrEqual(dimensions.intrinsic);
            await viewport.evaluate((element) => {
              element.scrollLeft = 0;
            });
            await verifyScroll(viewport, browserName);
          }
          expect(await host.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
        }
      }
      await page.screenshot({ path: info.outputPath(`${family}-${direction}-480.png`), fullPage: true });
      await page.emulateMedia({ forcedColors: 'active' });
      const button = page.locator(`aeliqo-${tags[0]} [part="data"] button`).first();
      await button.focus();
      await expect(button).toHaveCSS('outline-style', 'solid');
    });
  }
}

test('matrix retains readable columns and keyboard scrolling in a 240px container', async ({ page, browserName }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/tests/visualization/temporal.html');
  const host = page.locator('aeliqo-matrix');
  await host.evaluate((element) => {
    (element as HTMLElement).style.width = '240px';
  });
  await expect(host.locator('th').first()).toHaveCSS('min-width', '180px');
  const data = host.locator('[part="data"]');
  await verifyScroll(data, browserName);
  expect(await host.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
});

for (const family of ['hierarchy', 'temporal']) {
  test(`${family} exact data reflows at 320px with enlarged text`, async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 900 });
    await page.goto(`/tests/visualization/${family === 'hierarchy' ? 'index' : 'temporal'}.html`);
    await expect(page.locator(family === 'hierarchy' ? 'aeliqo-tree td' : 'aeliqo-timeline td').first()).toBeVisible();
    for (const scale of ['200%', '400%']) {
      await page.evaluate((size) => {
        document.documentElement.style.fontSize = size;
      }, scale);
      await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
    }
  });
}

async function verifyScroll(region: Locator, browserName: string): Promise<void> {
  await region.focus();
  await expect(region).toBeFocused();
  await region.press('ArrowRight');
  // Headless WebKit also ignores native arrow scrolling in plain HTML overflow regions.
  // Assert its scroll geometry here; Chromium and Firefox prove the native key behavior.
  if (browserName === 'webkit') await region.evaluate((element) => element.scrollBy(40, 0));
  await expect.poll(() => region.evaluate((element) => element.scrollLeft)).toBeGreaterThan(0);
}
