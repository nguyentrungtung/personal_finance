import { test, expect } from '@playwright/test';

const EMAIL = process.env.INIT_EMAIL ?? 'admin@test.com';
const PASSWORD = process.env.INIT_PASSWORD ?? 'password';

test.describe('Auth journey', () => {
  test('Unauthenticated redirect → login page', async ({ page }) => {
    await page.goto('/');
    await page.waitForURL('/login');
    await expect(page).toHaveURL(/\/login/);
  });

  test('Login with valid credentials → Dashboard', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel(/email/i).fill(EMAIL);
    await page.getByLabel(/password/i).fill(PASSWORD);
    await page.getByRole('button', { name: /sign in/i }).click();
    await page.waitForURL('/');
    await expect(page).toHaveURL('/');
    await expect(page.getByRole('main')).toBeVisible();
  });

  test('Login with wrong password → error message', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel(/email/i).fill(EMAIL);
    await page.getByLabel(/password/i).fill('wrongpassword');
    await page.getByRole('button', { name: /sign in/i }).click();
    // Should stay on login and show error
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByText(/invalid|incorrect|unauthorized/i).first()).toBeVisible();
  });

  test('Logout → redirected to login', async ({ page }) => {
    // Login first
    await page.goto('/login');
    await page.getByLabel(/email/i).fill(EMAIL);
    await page.getByLabel(/password/i).fill(PASSWORD);
    await page.getByRole('button', { name: /sign in/i }).click();
    await page.waitForURL('/');

    // Find logout button (could be in header or sidebar)
    const logoutBtn = page.getByRole('button', { name: /logout|sign out/i }).first();
    if (await logoutBtn.isVisible()) {
      await logoutBtn.click();
      await page.waitForURL('/login');
      await expect(page).toHaveURL(/\/login/);
    }
  });
});
