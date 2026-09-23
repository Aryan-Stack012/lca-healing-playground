import { test, expect } from '@playwright/test';

test.describe('console.html', () => {
  test('page loads and order reference ORD-99117 is visible in page content', async ({ page }) => {
    await page.goto('/lca-healing-playground/console.html');
    await expect(page).toHaveTitle(/Custom JS console/i);
    // ORD-99117 appears in the page's static content (order reference section)
    await expect(page.locator('body')).toContainText('ORD-99117');
  });

  test('Context A (default): order details rendered with context A label', async ({ page }) => {
    await page.goto('/lca-healing-playground/console.html');
    await expect(page).toHaveTitle(/Custom JS console/i);
    // The context label shows "context A" by default
    await expect(page.locator('#ctxLabel')).toContainText('context A');
    // The ledger section is rendered with order line items
    await expect(page.locator('#ledger')).toBeVisible();
  });

  test('Open Context B button opens console.html?ctx=B in new tab', async ({ page, context }) => {
    await page.goto('/lca-healing-playground/console.html');
    await expect(page).toHaveTitle(/Custom JS console/i);
    // Click the button and capture the new tab
    const [newPage] = await Promise.all([
      context.waitForEvent('page'),
      page.locator('#openConsoleB').click(),
    ]);
    await newPage.waitForLoadState('domcontentloaded');
    expect(newPage.url()).toContain('ctx=B');
  });
});

test.describe('email.html', () => {
  test('page loads and email compose/send UI is visible', async ({ page }) => {
    await page.goto('/lca-healing-playground/email.html');
    await expect(page).toHaveTitle(/Verification inbox/i);
    // The inbox section with the verify link is visible
    await expect(page.locator('#mail')).toBeVisible();
    await expect(page.locator('#verify-link')).toBeVisible();
    // The OTP code is shown in the email
    await expect(page.locator('#otp')).toBeVisible();
  });

  test('clicking Verify shows confirmation', async ({ page }) => {
    await page.goto('/lca-healing-playground/email.html');
    await expect(page).toHaveTitle(/Verification inbox/i);
    // Click the verify link
    await page.locator('#verify-link').click();
    // Confirmation appears in #result
    await expect(page.locator('#result')).toContainText('✅ Verified');
  });
});
