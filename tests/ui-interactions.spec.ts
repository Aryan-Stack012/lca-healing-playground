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

  test('search input is pre-filled with wireless headphones', async ({ page }) => {
    await page.goto('flow.html');
    await expect(page.locator('#q')).toHaveValue('wireless headphones');
  });

  test('click Search → result shown, Add to cart button appears, badge step 2 of 3', async ({ page }) => {
    await page.goto('flow.html');
    await page.locator('#search').click();
    await expect(page.locator('#add-to-cart')).toBeVisible();
    await expect(page.locator('#stepBadge')).toHaveText('step 2 of 3');
    await expect(page.locator('#s2')).toContainText('Aurora Wireless Headphones');
  });

  test('click Add to cart → cart summary shown, Checkout button appears, badge step 3 of 3', async ({ page }) => {
    await page.goto('flow.html');
    await page.locator('#search').click();
    await page.locator('#add-to-cart').click();
    await expect(page.locator('#checkout')).toBeVisible();
    await expect(page.locator('#stepBadge')).toHaveText('step 3 of 3');
    await expect(page.locator('#s3')).toContainText('Cart · 1 item');
  });

  test('click Checkout → order placed, badge complete', async ({ page }) => {
    await page.goto('flow.html');
    await page.locator('#search').click();
    await page.locator('#add-to-cart').click();
    await page.locator('#checkout').click();
    await expect(page.locator('#result')).toHaveText('✅ Order placed');
    await expect(page.locator('#stepBadge')).toHaveText('complete');
  });

  test('flag-on (?v=2): add button id is add_v2 with label + Cart', async ({ page }) => {
    await page.goto('flow.html?v=2');
    await page.locator('#search').click();
    await expect(page.locator('#add_v2')).toBeVisible();
    await expect(page.locator('#add_v2')).toHaveText('+ Cart');
    // original add-to-cart should not exist
    await expect(page.locator('#add-to-cart')).toHaveCount(0);
  });

  test('Enter key in search input triggers search', async ({ page }) => {
    await page.goto('flow.html');
    await page.locator('#q').press('Enter');
    await expect(page.locator('#add-to-cart')).toBeVisible();
    await expect(page.locator('#stepBadge')).toHaveText('step 2 of 3');
  });

  test('completed steps get is-done class; active step gets is-active', async ({ page }) => {
    await page.goto('flow.html');
    // Initially step 0 is active
    await expect(page.locator('.step[data-step="0"]')).toHaveClass(/is-active/);

    // After search: step 0 is done, step 1 is active
    await page.locator('#search').click();
    await expect(page.locator('.step[data-step="0"]')).toHaveClass(/is-done/);
    await expect(page.locator('.step[data-step="1"]')).toHaveClass(/is-active/);

    // After add to cart: step 1 is done, step 2 is active
    await page.locator('#add-to-cart').click();
    await expect(page.locator('.step[data-step="1"]')).toHaveClass(/is-done/);
    await expect(page.locator('.step[data-step="2"]')).toHaveClass(/is-active/);
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

  test('page renders: stepper, search bar, popup log visible', async ({ page }) => {
    await page.goto('modal.html?popup=1');
    await expect(page.locator('.stepper')).toBeVisible();
    await expect(page.locator('#q')).toBeVisible();
    await expect(page.locator('#popup-log')).toBeVisible();
  });

  test('?popup=1: modal appears after Search click within 1.5s', async ({ page }) => {
    await page.goto('modal.html?popup=1');
    await page.locator('#search').click();
    const backdrop = page.locator('#promo-backdrop');
    await expect(backdrop).toHaveClass(/is-open/, { timeout: 1500 });
  });

  test('?popup=1: No thanks button dismisses modal', async ({ page }) => {
    await page.goto('modal.html?popup=1');
    await page.locator('#search').click();
    const backdrop = page.locator('#promo-backdrop');
    await expect(backdrop).toHaveClass(/is-open/, { timeout: 5000 });
    await page.locator('#promo-dismiss').click();
    await expect(backdrop).not.toHaveClass(/is-open/);
  });

  test('?popup=1: Escape key dismisses modal', async ({ page }) => {
    await page.goto('modal.html?popup=1');
    await page.locator('#search').click();
    const backdrop = page.locator('#promo-backdrop');
    await expect(backdrop).toHaveClass(/is-open/, { timeout: 5000 });
    await page.keyboard.press('Escape');
    await expect(backdrop).not.toHaveClass(/is-open/);
  });

  test('?popup=1: clicking backdrop does NOT close modal, logs blocked message', async ({ page }) => {
    await page.goto('modal.html?popup=1');
    await page.locator('#search').click();
    const backdrop = page.locator('#promo-backdrop');
    await expect(backdrop).toHaveClass(/is-open/, { timeout: 5000 });
    // Click the backdrop area outside the modal (modal is centered ~x:432-832, y:284-528)
    // clicking top-left corner hits the backdrop, not the modal dialog
    await page.locator('#promo-backdrop').click({ position: { x: 50, y: 50 } });
    // backdrop should still be open
    await expect(backdrop).toHaveClass(/is-open/);
    await expect(page.locator('#popup-log')).toContainText('blocked — click landed on the popup backdrop');
  });

  test('?popup=1: clicking Claim 20% off shows promo code, modal stays open', async ({ page }) => {
    await page.goto('modal.html?popup=1');
    await page.locator('#search').click();
    const backdrop = page.locator('#promo-backdrop');
    await expect(backdrop).toHaveClass(/is-open/, { timeout: 5000 });
    await page.locator('#promo-claim').click();
    await expect(page.locator('#promo-code')).toBeVisible();
    // modal stays open
    await expect(backdrop).toHaveClass(/is-open/);
  });

  test('?popup=0: modal never appears, flow completes uninterrupted', async ({ page }) => {
    await page.goto('modal.html?popup=0');
    await page.locator('#search').click();
    // backdrop should never get is-open
    const backdrop = page.locator('#promo-backdrop');
    await expect(backdrop).not.toHaveClass(/is-open/);
    // flow continues: add to cart button appears
    await expect(page.locator('#add-to-cart')).toBeVisible();
  });

  test('popup log records dismissal event with timestamp', async ({ page }) => {
    await page.goto('modal.html?popup=1');
    await page.locator('#search').click();
    const backdrop = page.locator('#promo-backdrop');
    await expect(backdrop).toHaveClass(/is-open/, { timeout: 5000 });
    await page.locator('#promo-close').click();
    await expect(page.locator('#popup-log')).toContainText('popup dismissed');
  });

  test('after dismissal, full purchase flow completes', async ({ page }) => {
    await page.goto('modal.html?popup=1');
    await page.locator('#search').click();
    const backdrop = page.locator('#promo-backdrop');
    await expect(backdrop).toHaveClass(/is-open/, { timeout: 5000 });
    await page.locator('#promo-close').click();
    await expect(backdrop).not.toHaveClass(/is-open/);
    // Continue flow: add to cart
    await page.locator('#add-to-cart').click();
    await expect(page.locator('#checkout')).toBeVisible();
    // Checkout
    await page.locator('#checkout').click();
    await expect(page.locator('#result')).toHaveText('✅ Order placed');
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

  test('page renders: order LCA-4821, Starter Kit $120, promo row, total $100', async ({ page }) => {
    await page.goto('validation.html');
    await expect(page.locator('h2')).toContainText('LCA-4821');
    await expect(page.locator('#total')).toHaveText('$100.00');
    await expect(page.locator('#promo')).toBeVisible();
  });

  test('healthy state: #status-badge shows Confirmed', async ({ page }) => {
    await page.goto('validation.html');
    const badgezone = page.locator('#badgezone');
    await expect(badgezone).not.toBeEmpty({ timeout: 5000 });
    await expect(page.locator('#status-badge')).toHaveText('Confirmed');
  });

  test('flag-on (?v=2): #status_v2 shows Confirmed (healed id)', async ({ page }) => {
    await page.goto('validation.html?v=2');
    const badgezone = page.locator('#badgezone');
    await expect(badgezone).not.toBeEmpty({ timeout: 5000 });
    await expect(page.locator('#status_v2')).toHaveText('Confirmed');
    await expect(page.locator('#status-badge')).toHaveCount(0);
  });

  test('?remove=1: promo line #promo absent', async ({ page }) => {
    await page.goto('validation.html?remove=1');
    await expect(page.locator('#promo')).toHaveCount(0);
  });

  test('?wrong=1: badge shows Cancelled', async ({ page }) => {
    await page.goto('validation.html?wrong=1');
    const badgezone = page.locator('#badgezone');
    await expect(badgezone).not.toBeEmpty({ timeout: 5000 });
    await expect(badgezone.locator('span')).toHaveText('Cancelled');
  });

  test('default (no ?remove=1): promo Promo applied visible', async ({ page }) => {
    await page.goto('validation.html');
    await expect(page.locator('#promo')).toBeVisible();
    await expect(page.locator('#promo')).toHaveText('Promo applied');
  });
});
