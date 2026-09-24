import { test, expect } from '@playwright/test';

const BASE = 'https://aryan-stack012.github.io/lca-healing-playground';

test.describe('windows.html — SecurePay and OTP window flows', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE}/windows.html`);
  });

  test('page renders with order INV-4417 and payment state', async ({ page }) => {
    await expect(page.locator('body')).toContainText('INV-4417');
    await expect(page.locator('#payState')).toBeVisible();
    await expect(page.locator('#payBadge')).toContainText('unpaid');
  });

  test('"Pay with SecurePay" button opens a new window', async ({ page, context }) => {
    const [newPage] = await Promise.all([
      context.waitForEvent('page'),
      page.locator('#payWindow').click(),
    ]);
    await newPage.waitForLoadState('domcontentloaded');
    expect(newPage.url()).toContain('pay');
    await newPage.close();
  });

  test('"Pay with SecurePay (auto-close)" button opens a new window', async ({ page, context }) => {
    const [newPage] = await Promise.all([
      context.waitForEvent('page'),
      page.locator('#payAutoClose').click(),
    ]);
    await newPage.waitForLoadState('domcontentloaded');
    expect(newPage.url()).toContain('pay');
    await newPage.close();
  });

  test('"Pay and verify (two windows)" button opens a new window', async ({ page, context }) => {
    const [newPage] = await Promise.all([
      context.waitForEvent('page'),
      page.locator('#payTwo').click(),
    ]);
    await newPage.waitForLoadState('domcontentloaded');
    expect(newPage.url()).toBeTruthy();
    await newPage.close();
  });

  test('"Pay with SecurePay (redirects)" button opens a new window', async ({ page, context }) => {
    const [newPage] = await Promise.all([
      context.waitForEvent('page'),
      page.locator('#payRedirect').click(),
    ]);
    await newPage.waitForLoadState('domcontentloaded');
    expect(newPage.url()).toBeTruthy();
    await newPage.close();
  });

  test('payment window contains payment UI', async ({ page, context }) => {
    const [newPage] = await Promise.all([
      context.waitForEvent('page'),
      page.locator('#payWindow').click(),
    ]);
    await newPage.waitForLoadState('domcontentloaded');
    // The pay window should have some payment-related content
    await expect(newPage.locator('body')).not.toBeEmpty();
    await newPage.close();
  });

  test('payState shows awaiting authorisation initially', async ({ page }) => {
    await expect(page.locator('#payState')).toContainText('awaiting authorisation');
  });

  test('all four payment buttons are visible', async ({ page }) => {
    await expect(page.locator('#payWindow')).toBeVisible();
    await expect(page.locator('#payAutoClose')).toBeVisible();
    await expect(page.locator('#payTwo')).toBeVisible();
    await expect(page.locator('#payRedirect')).toBeVisible();
  });
});
