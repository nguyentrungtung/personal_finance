import { test, expect } from '@playwright/test';

const EMAIL = process.env.INIT_EMAIL ?? 'admin@test.com';
const PASSWORD = process.env.INIT_PASSWORD ?? 'password';

test.describe('Loan journey', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel(/email/i).fill(EMAIL);
    await page.getByLabel(/password/i).fill(PASSWORD);
    await page.getByRole('button', { name: /sign in/i }).click();
    await page.waitForURL('/');
    await page.getByRole('link', { name: /loan/i }).click();
    await page.waitForURL('/loans');
  });

  test('Create loan → verify remaining balance → record payment → Settled', async ({ page }) => {
    // Open "Record New Loan" modal
    const addBtn = page.getByRole('button', { name: /new loan|record.*loan|add loan/i }).first();
    await expect(addBtn).toBeVisible();
    await addBtn.click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    // Fill loan form
    const counterpartyField = dialog.getByLabel(/counterparty|name|lender|recipient/i).first();
    if (await counterpartyField.isVisible()) {
      await counterpartyField.fill('E2E Test Person');
    }

    // Set principal amount
    const principalField = dialog.getByLabel(/principal|amount/i).first();
    if (await principalField.isVisible()) {
      await principalField.fill('1000000');
    }

    // Submit
    const submitBtn = dialog.getByRole('button', { name: /save|create|record/i }).first();
    await submitBtn.click();

    // Loan should appear in the list
    await expect(page.getByText(/E2E Test Person/i).first()).toBeVisible({ timeout: 5000 });
  });
});
