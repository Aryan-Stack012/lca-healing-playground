import { test, expect } from '@playwright/test';

const BASE = 'https://aryan-stack012.github.io/lca-healing-playground';

test.describe('api.html', () => {
  test('loads and renders todo items from api/todo.json', async ({ page }) => {
    await page.goto(`${BASE}/api.html`);
    await expect(page).toHaveTitle(/API console/);

    // Wait for the fetch to complete — status badge changes from "fetching…"
    const statusBadge = page.locator('#status');
    await expect(statusBadge).toHaveText('200 OK', { timeout: 15000 });

    // Body pre element should contain the todo JSON fields
    const body = page.locator('#body');
    await expect(body).toContainText('"id": 1');
    await expect(body).toContainText('"title": "heal-demo"');
    await expect(body).toContainText('"completed": false');
  });
});

test.describe('data.html', () => {
  test('#token element is present on the page', async ({ page }) => {
    await page.goto(`${BASE}/data.html`);
    await expect(page).toHaveTitle(/Producer/);

    // The script renders either #token or #token_v2 inside #prod
    // Wait for the prod container to be populated
    const prod = page.locator('#prod');
    await expect(prod).not.toBeEmpty({ timeout: 10000 });

    // At least one of the two possible token element ids must exist
    const tokenEl = page.locator('#token, #token_v2');
    await expect(tokenEl.first()).toBeVisible();
    await expect(tokenEl.first()).toContainText('HEAL-7421');
  });

  test('healthy state: #token visible and contains HEAL-7421', async ({ page }) => {
    await page.goto(`${BASE}/data.html`);
    await expect(page).toHaveTitle(/Producer/);
    const prod = page.locator('#prod');
    await expect(prod).not.toBeEmpty({ timeout: 10000 });
    const token = page.locator('#token');
    await expect(token).toBeVisible();
    await expect(token).toContainText('HEAL-7421');
  });

  test('flag-on (?v=2): #token_v2 visible and contains HEAL-7421', async ({ page }) => {
    await page.goto(`${BASE}/data.html?v=2`);
    await expect(page).toHaveTitle(/Producer/);
    const prod = page.locator('#prod');
    await expect(prod).not.toBeEmpty({ timeout: 10000 });
    const tokenV2 = page.locator('#token_v2');
    await expect(tokenV2).toBeVisible();
    await expect(tokenV2).toContainText('HEAL-7421');
  });
});

test.describe('cookie.html', () => {
  test('loads and shows cookie-related UI', async ({ page }) => {
    await page.goto(`${BASE}/cookie.html`);
    await expect(page).toHaveTitle(/Browser config/);

    // Main heading
    await expect(page.locator('h1')).toContainText('Session');

    // The #out pre element is populated by the inline script
    const out = page.locator('#out');
    await expect(out).toBeVisible();
    // Should contain "cookies:" label written by the script
    await expect(out).toContainText('cookies:');

    // The seed code block should be visible
    await expect(page.locator('.code')).toContainText('localStorage.setItem');
  });

  test('#out pre shows cookies: label', async ({ page }) => {
    await page.goto(`${BASE}/cookie.html`);
    await expect(page).toHaveTitle(/Browser config/);
    await expect(page.locator('#out')).toContainText('cookies:');
  });

  test('seed code block shows localStorage.setItem and document.cookie instructions', async ({ page }) => {
    await page.goto(`${BASE}/cookie.html`);
    await expect(page.locator('.code')).toContainText('localStorage.setItem');
    await expect(page.locator('.code')).toContainText('document.cookie');
  });

  test('seeded localStorage value is echoed in #out', async ({ page }) => {
    // Set demoConfig in localStorage before navigating so the page echoes it
    await page.goto(`${BASE}/cookie.html`);
    await page.evaluate(() => localStorage.setItem('demoConfig', 'region=us-east'));
    await page.reload();
    await expect(page.locator('#out')).toContainText('region=us-east');
  });
});

test.describe('config.html', () => {
  test('loads and shows configuration details', async ({ page }) => {
    await page.goto(`${BASE}/config.html`);
    await expect(page).toHaveTitle(/Browser configuration/);

    // Main heading
    await expect(page.locator('h1')).toContainText('Run-config inspector');

    // Key sections are present
    await expect(page.locator('#geo-ip')).toBeVisible();
    await expect(page.locator('#hdr-rows')).toBeVisible();
    await expect(page.locator('#ck-rows')).toBeVisible();
    await expect(page.locator('#ls-rows')).toBeVisible();

    // Machine-readable snapshot pre element exists
    await expect(page.locator('#cfg-snapshot')).toBeVisible();

    // Re-run button is present
    await expect(page.locator('#rerun')).toBeVisible();
  });
});
