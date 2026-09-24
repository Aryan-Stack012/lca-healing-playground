import { test, expect } from '@playwright/test';

const BASE = 'https://aryan-stack012.github.io/lca-healing-playground';

// ── 404.html ─────────────────────────────────────────────────────────────────
test.describe('404.html — Custom error page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE}/404.html`);
  });

  test('page title contains "404"', async ({ page }) => {
    await expect(page).toHaveTitle(/404/);
  });

  test('badge shows "404 · unhealable"', async ({ page }) => {
    await expect(page.locator('.tag')).toContainText('404 · unhealable');
  });

  test('heading says the page is gone', async ({ page }) => {
    await expect(page.locator('h1')).toContainText('This page is gone');
  });

  test('requested path is shown in the code element', async ({ page }) => {
    const pathEl = page.locator('#path');
    await expect(pathEl).toBeVisible();
    const text = await pathEl.textContent();
    expect(text).toContain('404.html');
  });

  test('back-to-hub link is present and points to playground root', async ({ page }) => {
    const link = page.locator('#home');
    await expect(link).toBeVisible();
    await expect(link).toContainText('Back to the playground hub');
    const href = await link.getAttribute('href');
    expect(href).toBeTruthy();
  });

  test('page is self-contained — renders without external stylesheets', async ({ page }) => {
    // The 404 page is intentionally self-contained (inline styles)
    await expect(page.locator('main')).toBeVisible();
    await expect(page.locator('.tag')).toBeVisible();
  });
});

// ── visual.html ───────────────────────────────────────────────────────────────
test.describe('visual.html — Visual diff page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE}/visual.html`);
  });

  test('page title is "Visual diff · LCA Playground"', async ({ page }) => {
    await expect(page).toHaveTitle('Visual diff · LCA Playground');
  });

  test('eyebrow label shows "Never heals · visual"', async ({ page }) => {
    await expect(page.locator('.eyebrow')).toContainText('Never heals · visual');
  });

  test('heading shows "Visual snapshot"', async ({ page }) => {
    await expect(page.locator('h1')).toHaveText('Visual snapshot');
  });

  test('section title shows "Snapshot · home hero"', async ({ page }) => {
    await expect(page.locator('h2')).toContainText('Snapshot · home hero');
  });

  test('non-deterministic badge is visible', async ({ page }) => {
    await expect(page.locator('.badge--err')).toContainText('non-deterministic');
  });

  test('color box renders with a background color', async ({ page }) => {
    const box = page.locator('#box');
    await expect(box).toBeVisible();
    const bg = await box.evaluate((el: HTMLElement) => el.style.background || el.style.backgroundColor);
    expect(bg).toBeTruthy();
  });

  test('number in color box is a numeric value 0–999', async ({ page }) => {
    const box = page.locator('#box');
    const text = await box.textContent();
    const num = parseInt(text?.trim() ?? '', 10);
    expect(num).toBeGreaterThanOrEqual(0);
    expect(num).toBeLessThanOrEqual(999);
  });

  test('metadata rows show Baseline, Comparison, Threshold', async ({ page }) => {
    await expect(page.locator('.row__k').nth(0)).toContainText('Baseline');
    await expect(page.locator('.row__k').nth(1)).toContainText('Comparison');
    await expect(page.locator('.row__k').nth(2)).toContainText('Threshold');
  });

  test('Baseline value is "build LCA-4795"', async ({ page }) => {
    await expect(page.locator('.row__v').nth(0)).toHaveText('build LCA-4795');
  });

  test('Threshold value is "0.1%"', async ({ page }) => {
    await expect(page.locator('.row__v').nth(2)).toHaveText('0.1%');
  });
});

// ── customjs-fail.html ────────────────────────────────────────────────────────
test.describe('customjs-fail.html — Custom JS failure catalogue', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE}/customjs-fail.html`);
  });

  test('page title is "Custom JS failures · LCA Playground"', async ({ page }) => {
    await expect(page).toHaveTitle('Custom JS failures · LCA Playground');
  });

  test('heading shows "Eighteen ways it breaks"', async ({ page }) => {
    await expect(page.locator('h1')).toHaveText('Eighteen ways it breaks');
  });

  test('18 failure cards render in #cases', async ({ page }) => {
    // Wait for JS to render the cards
    await expect(page.locator('#cases .fcard')).toHaveCount(18);
  });

  test('"Run all 18 in this page" button is present', async ({ page }) => {
    await expect(page.locator('#runAll')).toBeVisible();
    await expect(page.locator('#runAll')).toContainText('Run all 18');
  });

  test('Reset button is present', async ({ page }) => {
    await expect(page.locator('#resetAll')).toBeVisible();
  });

  test('summary element shows "Nothing run yet." initially', async ({ page }) => {
    await expect(page.locator('#summary')).toContainText('Nothing run yet.');
  });

  test('fixtures section has silentField input', async ({ page }) => {
    await expect(page.locator('#silentField')).toBeVisible();
  });

  test('fixtures section has hosted total iframe', async ({ page }) => {
    await expect(page.locator('#totalFrame')).toBeVisible();
  });

  test('silentState shows "No discount applied." initially', async ({ page }) => {
    await expect(page.locator('#silentState')).toContainText('No discount applied.');
  });

  test('Run all 18 button executes and updates summary', async ({ page }) => {
    await page.locator('#runAll').click();
    // Wait for all 18 to run (some have async delays up to 4s each)
    await expect(page.locator('#summary')).toContainText('18 cases', { timeout: 30000 });
  });

  test('Reset button clears all card results', async ({ page }) => {
    await page.locator('#runAll').click();
    await expect(page.locator('#summary')).not.toContainText('Nothing run yet.', { timeout: 15000 });
    await page.locator('#resetAll').click();
    await expect(page.locator('#summary')).toContainText('Nothing run yet.');
  });

  test('individual card Run button executes and shows result', async ({ page }) => {
    const firstRunBtn = page.locator('#cases button[data-run]').first();
    await firstRunBtn.click();
    const firstOut = page.locator('#out-0');
    await expect(firstOut).not.toContainText('Not run.');
  });

  test('Section F replay section is visible', async ({ page }) => {
    await expect(page.locator('#replaySection')).toBeVisible();
  });

  test('replay badge shows flag state', async ({ page }) => {
    await expect(page.locator('#replayBadge')).not.toContainText('reading flag…', { timeout: 5000 });
  });

  test('footer link to console.html is present', async ({ page }) => {
    await expect(page.locator('footer a[href*="console.html"]')).toBeVisible();
  });
});
