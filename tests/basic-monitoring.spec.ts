import { expect, test } from '@playwright/test';

test('built public site emits bounded content-free RUM and a navigation trace', async ({ page, context, request, baseURL }) => {
  const received: Array<{ signal: string; payload: string }> = [];
  // Serve the built local artifact under its production hostname entirely in
  // the browser harness. No production site, collector or external API is used.
  await context.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    if (url.origin !== 'https://aeliqo.com') return route.abort();
    if (url.pathname === '/browser-monitoring.json') {
      return route.fulfill({ json: { enabled: true } });
    }
    if (url.pathname === '/otel/v1/metrics' || url.pathname === '/otel/v1/traces') {
      received.push({ signal: url.pathname, payload: route.request().postData() ?? '' });
      expect(route.request().headers().cookie).toBeUndefined();
      expect(route.request().headers().referer).toBeUndefined();
      return route.fulfill({ json: {} });
    }
    return route.fulfill({ response: await request.get(`${baseURL}${url.pathname}${url.search}`) });
  });
  await page.goto('https://aeliqo.com/?private_token=must-not-leak');
  await expect.poll(() => received.some(({ payload }) => payload.includes('browser.page_views'))).toBe(true);
  await page.evaluate(() => {
    const button = document.createElement('button');
    button.textContent = 'Monitoring interaction probe';
    button.addEventListener('click', () => {
      const end = performance.now() + 80;
      while (performance.now() < end) { /* Real browser event-duration sample. */ }
    });
    document.body.append(button);
  });
  await page.getByRole('button', { name: 'Monitoring interaction probe' }).click();
  await page.waitForTimeout(200);
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect.poll(() => received.some(({ payload }) => payload.includes('browser.web_vital.lcp'))).toBe(true);
  await expect.poll(() => received.some(({ payload }) => payload.includes('browser.navigation'))).toBe(true);
  await expect.poll(() => received.some(({ payload }) => payload.includes('browser.web_vital.inp'))).toBe(true);
  expect(received.length).toBeLessThanOrEqual(10);
  expect(received.map(({ payload }) => payload).join('')).not.toMatch(/private_token|must-not-leak|Monitoring interaction probe|url\.full|session\.id/);
});
