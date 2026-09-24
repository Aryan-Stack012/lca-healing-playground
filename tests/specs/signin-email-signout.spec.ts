import { test, expect } from '@playwright/test';

const VALID_EMAIL    = 'testuser@example.com';
const VALID_PASSWORD = process.env.LCA_PASSWORD || 'U4C3-AJFE-8ZK2-X76S';

// TC-3514: Signin-email — sign out clears session and returns to sign-in form
test.describe('signin-email.html — Sign out', () => {
  test('sign out clears session and returns to sign-in form', async ({ page }) => {
    // Navigate to the sign-in page
    await page.goto('https://aryan-stack012.github.io/lca-healing-playground/signin-email.html');

    // Sign in with valid credentials
    await page.getByTestId('signin-email').fill(VALID_EMAIL);
    await page.getByTestId('signin-password').fill(VALID_PASSWORD);
    await page.getByTestId('signin-submit').click();

    // Wait for dashboard to appear
    await expect(page.getByTestId('signin-dashboard')).toBeVisible();

    // Click Sign out
    await page.getByTestId('logout').click();

    // Dashboard should be hidden
    await expect(page.getByTestId('signin-dashboard')).toBeHidden();

    // Sign-in form should be visible again
    await expect(page.getByTestId('signin-email')).toBeVisible();
  });
});
