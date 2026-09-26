import { expect, test } from '@playwright/test';

test('public playground keeps model credentials and provider transport outside the browser', async ({ page }) => {
  const requests: string[] = [];
  page.on('request', (request) => requests.push(request.url()));
  await page.goto('/playground/');
  await expect(page.locator('#pg-receipt-state')).toHaveText('renderer-ready');
  await page.getByRole('button', { name: 'Connect AI' }).click();
  await expect(page.locator('#pg-deepseek-key')).toHaveCount(0);
  await expect(page.locator('#pg-connection-kind option')).toHaveText([
    'Local Playground host',
    'WebMCP (experimental)',
    'Demo agent (scripted)',
  ]);
  await page.getByRole('button', { name: 'Check connection' }).click();
  await expect(page.locator('#pg-connect-status')).not.toContainText('Checking capability');
  await expect(page.locator('#pg-prompt')).toBeDisabled();
  await page.getByRole('button', { name: 'Without AI' }).click();
  await page.getByRole('button', { name: 'People in Jakarta' }).click();
  await expect(page.locator('#pg-committed-filter')).toContainText('Jakarta');
  expect(requests.every((url) => new URL(url).origin === new URL(page.url()).origin)).toBe(true);
  await expect(page.locator('#pg-model-calls')).toHaveText('0');
});
