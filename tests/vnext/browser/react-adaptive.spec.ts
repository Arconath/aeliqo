import { expect, test } from '@playwright/test';

test('native React resolver measures its container when the host resizes', async ({ page }) => {
  await page.goto('/react-adaptive/');
  await expect(page.getByTestId('native-choice')).toHaveText('wide table');

  await page.getByRole('button', { name: 'Narrow host' }).click();
  await expect(page.getByTestId('native-choice')).toHaveText('narrow list');
});
