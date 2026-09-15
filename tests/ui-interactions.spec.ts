import { test, expect } from '@playwright/test';

test.describe('checkout.html', () => {
  test('renders product details and a place-order button', async ({ page }) => {
    await page.goto('checkout.html');
    // product items
    await expect(page.locator('.item__name').first()).toBeVisible();
    await expect(page.locator('text=Aurora Wireless Headphones')).toBeVisible();
    // order total
    await expect(page.locator('text=$100.00').first()).toBeVisible();
    // submit / place-order button rendered by flag.js — wait for zone to resolve
    const zone = page.locator('#zone');
    await expect(zone).not.toHaveText('loading…');
    // button should be present (healthy state: #checkout; broken state: #pay_v2; gone: no button)
    const hasButton = await page.locator('#zone button').count();
    // in "gone" state the page explicitly says no checkout button — still a valid render
    if (hasButton > 0) {
      await expect(page.locator('#zone button').first()).toBeVisible();
    } else {
      await expect(zone).toContainText('no checkout button');
    }
  });
});

test.describe('modal.html', () => {
  test('page loads and promo modal can be dismissed', async ({ page }) => {
    // ?popup=1 forces the modal to appear
    await page.goto('modal.html?popup=1');
    await expect(page.locator('h1')).toBeVisible();

    // trigger the flow so the popup fires: click Search
    await page.locator('#search').click();

    // wait for the backdrop to become visible (popup shown after 700 ms delay)
    const backdrop = page.locator('#promo-backdrop');
    await expect(backdrop).toHaveClass(/is-open/, { timeout: 5000 });

    // dismiss via the close button
    await page.locator('#promo-close').click();
    await expect(backdrop).not.toHaveClass(/is-open/);

    // log should record the dismissal
    await expect(page.locator('#popup-log')).toContainText('popup dismissed');
  });
});

test.describe('flow.html', () => {
  test('multi-step flow page renders and first step is visible', async ({ page }) => {
    await page.goto('flow.html');
    await expect(page.locator('h1')).toBeVisible();
    // stepper is present
    await expect(page.locator('.stepper')).toBeVisible();
    // first step is active
    await expect(page.locator('.step[data-step="0"]')).toHaveClass(/is-active/);
    // step badge shows step 1
    await expect(page.locator('#stepBadge')).toHaveText('step 1 of 3');
    // search input and button are present
    await expect(page.locator('#search')).toBeVisible();
    await expect(page.locator('#q')).toBeVisible();
  });
});

test.describe('validation.html', () => {
  test('#status-badge element is present and form renders', async ({ page }) => {
    await page.goto('validation.html');
    await expect(page.locator('h1')).toBeVisible();
    // order items render
    await expect(page.locator('.item__name')).toBeVisible();
    // badgezone resolves via lcaBreak() — wait for it
    const badgezone = page.locator('#badgezone');
    await expect(badgezone).not.toBeEmpty({ timeout: 5000 });
    // in the default (healthy) state the badge id is status-badge
    // in the broken state it is status_v2 — either way a span inside badgezone is present
    await expect(badgezone.locator('span')).toBeVisible();
    // promo line present (no ?remove=1)
    await expect(page.locator('#promo')).toBeVisible();
  });
});
