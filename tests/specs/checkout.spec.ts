import { test, expect } from '@playwright/test';

const CHECKOUT_URL = 'checkout.html';

test.describe('Checkout Page', () => {

  test('page loads with correct title and heading', async ({ page }) => {
    await page.goto(CHECKOUT_URL);
    await expect(page).toHaveTitle(/checkout/i);
    await expect(page.locator('h1')).toBeVisible();
  });

  test('order items and prices are displayed correctly', async ({ page }) => {
    await page.goto(CHECKOUT_URL);
    await expect(page.getByText('Aurora Wireless Headphones')).toBeVisible();
    await expect(page.getByText('$79')).toBeVisible();
    await expect(page.getByText('USB-C Braided Cable')).toBeVisible();
    await expect(page.getByText('$12')).toBeVisible();
    await expect(page.getByText('Coverage Plan')).toBeVisible();
    await expect(page.getByText('$9')).toBeVisible();
  });

  test('summary totals are correct', async ({ page }) => {
    await page.goto(CHECKOUT_URL);
    await expect(page.getByText('$100').first()).toBeVisible();
    // Subtotal and Total both show $100
    const hundredDollarEls = page.getByText('$100');
    await expect(hundredDollarEls).toHaveCount(2);
  });

  test('default state: checkout button is visible and clicking it shows order placed', async ({ page }) => {
    await page.goto(CHECKOUT_URL);
    const checkoutBtn = page.locator('#checkout');
    await expect(checkoutBtn).toBeVisible();
    await checkoutBtn.click();
    await expect(page.getByText('✅ Order placed')).toBeVisible();
  });

  test('flag-on state (?v=2): pay button places order; decoy continue button shows wrong element message', async ({ page }) => {
    await page.goto(CHECKOUT_URL + '?v=2');

    // Pay button (correct) is visible
    const payBtn = page.locator('#pay_v2');
    await expect(payBtn).toBeVisible();

    // Decoy Continue button click shows error
    const decoyBtn = page.getByRole('button', { name: 'Continue' });
    await expect(decoyBtn).toBeVisible();
    await decoyBtn.click();
    await expect(page.getByText('❌ Wrong element clicked (decoy)')).toBeVisible();

    // Now click the real Pay button — should show order placed
    await payBtn.click();
    await expect(page.getByText('✅ Order placed')).toBeVisible();
  });

});
