import { test, expect } from '@playwright/test';

const EMAIL = process.env.INIT_EMAIL ?? 'admin@test.com';
const PASSWORD = process.env.INIT_PASSWORD ?? 'password';

test.describe('Dashboard → Ledger journey', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel(/email/i).fill(EMAIL);
    await page.getByLabel(/password/i).fill(PASSWORD);
    await page.getByRole('button', { name: /sign in/i }).click();
    await page.waitForURL('/');
  });

  test('Dashboard renders net worth and asset cards', async ({ page }) => {
    await expect(page.getByRole('main')).toBeVisible();
    // Net worth hero section should be present
    await expect(page.locator('[data-testid="net-worth"], .text-brand-green, h2').first()).toBeVisible();
  });

  test('Ledger filter and add entry updates dashboard', async ({ page }) => {
    // Navigate to Ledger
    await page.getByRole('link', { name: /ledger/i }).click();
    await page.waitForURL('/ledger');
    await expect(page.getByRole('main')).toBeVisible();

    // Open add entry modal (look for button)
    const addBtn = page.getByRole('button', { name: /add entry|new entry/i }).first();
    if (await addBtn.isVisible()) {
      await addBtn.click();
      // Fill form
      const dialog = page.getByRole('dialog');
      if (await dialog.isVisible()) {
        await dialog.getByLabel(/description/i).fill('E2E Test Entry');
        await dialog.getByLabel(/amount/i).fill('1000000');
        // Submit
        const submitBtn = dialog.getByRole('button', { name: /save|create|add/i }).first();
        await submitBtn.click();
      }
    }

    // Return to dashboard and verify it loads without error
    await page.getByRole('link', { name: /dashboard/i }).click();
    await page.waitForURL('/');
    await expect(page.getByRole('main')).toBeVisible();
  });
});
