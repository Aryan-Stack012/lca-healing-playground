import { test, expect } from '@playwright/test';

const CHECKOUT_URL = 'checkout.html';

test.describe('Checkout Page', () => {

  test('page loads with correct title and heading', async ({ page }) => {
    await page.goto(CHECKOUT_URL);
    await expect(page).toHaveTitle(/checkout/i);
    await expect(page.locator('h1')).toHaveText('Checkout');
  });

  test('order items and prices are displayed correctly', async ({ page }) => {
    await page.goto(CHECKOUT_URL);
    await expect(page.locator('.item__name').nth(0)).toHaveText('Aurora Wireless Headphones');
    await expect(page.locator('.item__price').nth(0)).toHaveText('$79.00');
    await expect(page.locator('.item__name').nth(1)).toHaveText('USB-C Braided Cable');
    await expect(page.locator('.item__price').nth(1)).toHaveText('$12.00');
    await expect(page.locator('.item__name').nth(2)).toHaveText('Coverage Plan');
    await expect(page.locator('.item__price').nth(2)).toHaveText('$9.00');
  });

  test('summary totals are correct', async ({ page }) => {
    await page.goto(CHECKOUT_URL);
    // Subtotal $100, Shipping $0, Tax $0, Total $100
    await expect(page.getByText('Subtotal')).toBeVisible();
    await expect(page.getByText('Shipping')).toBeVisible();
    await expect(page.getByText('Tax')).toBeVisible();
    // Both Subtotal and Total show $100.00
    const hundredEls = page.locator('.row__v', { hasText: '$100.00' });
    await expect(hundredEls).toHaveCount(2);
    await expect(page.locator('.row__v', { hasText: '$0.00' })).toHaveCount(2);
  });

  test('shipping details are displayed correctly', async ({ page }) => {
    await page.goto(CHECKOUT_URL);
    await expect(page.getByText('Ada Lovelace · London')).toBeVisible();
    await expect(page.getByText('Visa •••• 4242')).toBeVisible();
    await expect(page.getByText('Free · 2–4 days')).toBeVisible();
  });

  test('default state: checkout button is visible and clicking it shows order placed', async ({ page }) => {
    await page.goto(CHECKOUT_URL);
    const zone = page.locator('#zone');
    await expect(zone).not.toHaveText('loading…', { timeout: 5000 });
    const checkoutBtn = page.locator('#checkout');
    await expect(checkoutBtn).toBeVisible();
    await checkoutBtn.click();
    await expect(page.locator('#result')).toHaveText('✅ Order placed');
  });

  test('flag-on state (?v=2): pay button places order; decoy continue button shows wrong element message', async ({ page }) => {
    await page.goto(CHECKOUT_URL + '?v=2');
    const zone = page.locator('#zone');
    await expect(zone).not.toHaveText('loading…', { timeout: 5000 });

    // Pay button (correct) is visible
    const payBtn = page.locator('#pay_v2');
    await expect(payBtn).toBeVisible();

    // Decoy Continue button click shows error
    const decoyBtn = page.locator('#continue_btn');
    await expect(decoyBtn).toBeVisible();
    await decoyBtn.click();
    await expect(page.locator('#result')).toHaveText('❌ Wrong element clicked (decoy)');

    // Now click the real Pay button — should show order placed
    await payBtn.click();
    await expect(page.locator('#result')).toHaveText('✅ Order placed');
  });

  test('gone state (?gone=1): zone shows no checkout button message', async ({ page }) => {
    await page.goto(CHECKOUT_URL + '?gone=1');
    const zone = page.locator('#zone');
    await expect(zone).not.toHaveText('loading…', { timeout: 5000 });
    await expect(zone).toContainText('no checkout button — unhealable');
  });

  test('zone resolves from loading within timeout', async ({ page }) => {
    await page.goto(CHECKOUT_URL);
    const zone = page.locator('#zone');
    await expect(zone).not.toHaveText('loading…', { timeout: 5000 });
  });

});
