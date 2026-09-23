import { test, expect } from '@playwright/test';

// ─── tabs.html ────────────────────────────────────────────────────────────────

test.describe('tabs.html', () => {
  test('page renders: 6 openers, handoff inbox, licence seats, registry sections', async ({ page }) => {
    await page.goto('tabs.html');

    // 6 opener buttons/links
    await expect(page.locator('#openInvoice')).toBeVisible();
    await expect(page.locator('#openScript')).toBeVisible();
    await expect(page.locator('#openTwin')).toBeVisible();
    await expect(page.locator('#openFramed')).toBeVisible();
    await expect(page.locator('#openSelfClosing')).toBeVisible();
    await expect(page.locator('#openBlocked')).toBeVisible();

    // Handoff inbox section
    await expect(page.locator('#handoff')).toBeVisible();
    await expect(page.locator('#handoff')).toHaveText('No handoff received yet.');

    // Licence seats section
    await expect(page.locator('#seats')).toBeVisible();

    // Registry section
    await expect(page.locator('#registry')).toBeVisible();
  });

  test('anchor opener opens new tab to tabs/target.html?tab=B', async ({ page, context }) => {
    await page.goto('tabs.html');

    const [newTab] = await Promise.all([
      context.waitForEvent('page'),
      page.locator('#openInvoice').click(),
    ]);

    await newTab.waitForLoadState('domcontentloaded');
    expect(newTab.url()).toContain('tabs/target.html');
    expect(newTab.url()).toContain('tab=B');
  });

  test('scripted opener button is enabled after flag resolves', async ({ page }) => {
    await page.goto('tabs.html');

    // Button starts disabled, becomes enabled after flag resolves (flag.json fetch)
    await expect(page.locator('#openScript')).toBeEnabled({ timeout: 15000 });
  });

  test('"Open a second copy of tab B" opens twin tab with same URL', async ({ page, context }) => {
    await page.goto('tabs.html');

    const [twinTab] = await Promise.all([
      context.waitForEvent('page'),
      page.locator('#openTwin').click(),
    ]);

    await twinTab.waitForLoadState('domcontentloaded');
    expect(twinTab.url()).toContain('tabs/target.html');
    expect(twinTab.url()).toContain('tab=B');
  });

  test('"Open the framed approval" opens tabs/framed.html?tab=F', async ({ page, context }) => {
    await page.goto('tabs.html');

    const [framedTab] = await Promise.all([
      context.waitForEvent('page'),
      page.locator('#openFramed').click(),
    ]);

    await framedTab.waitForLoadState('domcontentloaded');
    expect(framedTab.url()).toContain('tabs/framed.html');
    expect(framedTab.url()).toContain('tab=F');
  });

  test('blocked opener shows "Blocked by site policy — no tab was opened."', async ({ page }) => {
    await page.goto('tabs.html');
    await page.locator('#openBlocked').click();
    await expect(page.locator('#openState')).toHaveText('Blocked by site policy — no tab was opened.');
  });

  test('"Add licence seat" increments seat count (starts at 1, becomes 2)', async ({ page }) => {
    await page.goto('tabs.html');
    await expect(page.locator('#seats')).toHaveText('1');
    await page.locator('#addSeat').click();
    await expect(page.locator('#seats')).toHaveText('2');
  });

  test('"Show licence details" reveals details on same tab (no new tab)', async ({ page, context }) => {
    await page.goto('tabs.html');

    // Track any new pages opened
    let newPageOpened = false;
    context.on('page', () => { newPageOpened = true; });

    await page.locator('#showDetails').click();

    // Details section should now be visible
    await expect(page.locator('#details')).toBeVisible();
    await expect(page.locator('#detailsText')).toBeVisible();

    // No new tab should have been opened
    expect(newPageOpened).toBe(false);
  });

  test('handoff inbox shows "No handoff received yet." initially', async ({ page }) => {
    await page.goto('tabs.html');
    await expect(page.locator('#handoff')).toHaveText('No handoff received yet.');
  });
});

// ─── frames.html ─────────────────────────────────────────────────────────────

test.describe('frames.html', () => {
  test('page renders: card number, expiry, CVC fields; iframe section; shadow DOM section', async ({ page }) => {
    await page.goto('frames.html');

    await expect(page.locator('#cardno')).toBeVisible();
    await expect(page.locator('#exp')).toBeVisible();
    await expect(page.locator('#cvc')).toBeVisible();
    await expect(page.locator('#frame')).toBeVisible();
    await expect(page.locator('#host')).toBeVisible();
  });

  test('healthy state: iframe loads and contains a Checkout button', async ({ page }) => {
    await page.goto('frames.html');

    const frame = page.frameLocator('#frame');
    await expect(frame.locator('button[aria-label="Checkout"]')).toBeVisible({ timeout: 10000 });
  });

  test('click iframe checkout button → "✅ Paid" shown inside iframe', async ({ page }) => {
    await page.goto('frames.html');

    const frame = page.frameLocator('#frame');
    await frame.locator('button[aria-label="Checkout"]').click();
    await expect(frame.locator('#fr')).toHaveText('✅ Paid');
  });

  test('healthy state: shadow DOM contains a Checkout button', async ({ page }) => {
    await page.goto('frames.html');

    // Shadow DOM button — pierce via evaluate to check presence
    const hasBtn = await page.evaluate(() => {
      const host = document.getElementById('host');
      if (!host || !host.shadowRoot) return false;
      return !!host.shadowRoot.querySelector('button[aria-label="Checkout"]');
    });
    expect(hasBtn).toBe(true);
  });

  test('click shadow DOM checkout button → "✅ Paid (shadow root)" shown', async ({ page }) => {
    await page.goto('frames.html');

    await page.evaluate(() => {
      const host = document.getElementById('host');
      if (host && host.shadowRoot) {
        const btn = host.shadowRoot.querySelector<HTMLButtonElement>('button[aria-label="Checkout"]');
        if (btn) btn.click();
      }
    });
    await expect(page.locator('#sresult')).toHaveText('✅ Paid (shadow root)');
  });

  test('flag-on (?v=2): iframe button label changes to "Pay"', async ({ page }) => {
    await page.goto('frames.html?v=2');

    const frame = page.frameLocator('#frame');
    await expect(frame.locator('button[aria-label="Checkout"]')).toBeVisible({ timeout: 10000 });
    await expect(frame.locator('button[aria-label="Checkout"]')).toHaveText('Pay');
  });

  test('flag-on (?v=2): clicking Pay in iframe → "✅ Paid"', async ({ page }) => {
    await page.goto('frames.html?v=2');

    const frame = page.frameLocator('#frame');
    await frame.locator('button[aria-label="Checkout"]').click();
    await expect(frame.locator('#fr')).toHaveText('✅ Paid');
  });

  test('flag-on (?v=2): shadow DOM button label changes to "Pay"', async ({ page }) => {
    await page.goto('frames.html?v=2');

    const label = await page.evaluate(() => {
      const host = document.getElementById('host');
      if (!host || !host.shadowRoot) return null;
      const btn = host.shadowRoot.querySelector<HTMLButtonElement>('button[aria-label="Checkout"]');
      return btn ? btn.textContent : null;
    });
    expect(label).toBe('Pay');
  });

  test('flag-on (?v=2): clicking Pay in shadow DOM → "✅ Paid (shadow root)"', async ({ page }) => {
    await page.goto('frames.html?v=2');

    await page.evaluate(() => {
      const host = document.getElementById('host');
      if (host && host.shadowRoot) {
        const btn = host.shadowRoot.querySelector<HTMLButtonElement>('button[aria-label="Checkout"]');
        if (btn) btn.click();
      }
    });
    await expect(page.locator('#sresult')).toHaveText('✅ Paid (shadow root)');
  });
});

// ─── windows.html ─────────────────────────────────────────────────────────────

test.describe('windows.html', () => {
  test('page renders with order INV-4417 and amount $149.00', async ({ page }) => {
    await page.goto('windows.html');

    await expect(page.locator('#orderRef')).toHaveText('INV-4417');
    await expect(page.locator('#orderTotal')).toHaveText('$149.00');
  });

  test('open buttons are present', async ({ page }) => {
    await page.goto('windows.html');

    await expect(page.locator('#payWindow')).toBeVisible();
    await expect(page.locator('#payAutoClose')).toBeVisible();
    await expect(page.locator('#payTwo')).toBeVisible();
    await expect(page.locator('#payRedirect')).toBeVisible();
  });

  test('"Open SecurePay" button is visible and clickable', async ({ page }) => {
    await page.goto('windows.html');

    // Buttons are enabled after flag resolves
    await expect(page.locator('#payWindow')).toBeEnabled({ timeout: 10000 });
    await expect(page.locator('#payWindow')).toBeVisible();
  });

  test('"Open SecurePay + OTP" button is visible and clickable', async ({ page }) => {
    await page.goto('windows.html');

    await expect(page.locator('#payTwo')).toBeEnabled({ timeout: 10000 });
    await expect(page.locator('#payTwo')).toBeVisible();
  });
});

// ─── smart-tab.html ───────────────────────────────────────────────────────────

test.describe('smart-tab.html', () => {
  test('page renders: baseline section, score oracle section, launchers section visible', async ({ page }) => {
    await page.goto('smart-tab.html');

    await expect(page.locator('#baseline')).toBeVisible();
    // #scoreboard is empty (no candidates yet) — check the oracle section heading instead
    await expect(page.locator('#verdict')).toBeVisible();
    await expect(page.locator('#launchers')).toBeVisible();
  });

  test('score oracle shows "No candidate tabs open yet." initially', async ({ page }) => {
    await page.goto('smart-tab.html');

    await expect(page.locator('#verdict')).toHaveText('No candidate tabs open yet.');
  });
});
