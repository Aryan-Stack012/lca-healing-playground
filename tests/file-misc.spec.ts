import { test, expect } from '@playwright/test';

test.describe('index.html — homepage', () => {
  test('loads and shows the 60-case map/navigation', async ({ page }) => {
    await page.goto('/lca-healing-playground/');
    await expect(page).toHaveTitle(/LCA Self-Healing Playground/i);
    // The case-count badge shows the full range label
    const caseCount = page.locator('#caseCount');
    await expect(caseCount).toBeVisible();
    await expect(caseCount).toContainText('S1');
    await expect(caseCount).toContainText('S60');
    // The case table renders 60 case rows plus a hidden "no results" row = 61 total
    const rows = page.locator('#caseBody tr');
    await expect(rows).toHaveCount(61);
  });
});

test.describe('download.html — file download', () => {
  test('loads and shows a download link for report.txt', async ({ page }) => {
    await page.goto('/lca-healing-playground/download.html');
    await expect(page).toHaveTitle(/File download/i);
    const dlLink = page.locator('#dl');
    await expect(dlLink).toBeVisible();
    await expect(dlLink).toHaveAttribute('href', 'files/report.txt');
    await expect(dlLink).toHaveAttribute('download', 'report.txt');
  });
});

test.describe('upload.html — file upload', () => {
  test('loads and shows a file input', async ({ page }) => {
    await page.goto('/lca-healing-playground/upload.html');
    await expect(page).toHaveTitle(/File upload/i);
    const fileInput = page.locator('input[type="file"]#file');
    await expect(fileInput).toBeAttached();
    // The file-selector button is the upload trigger — verify the input accepts .txt
    await expect(fileInput).toHaveAttribute('accept', '.txt,text/plain');
  });
});

test.describe('timing.html — timed element', () => {
  test('loads and the checkout button eventually appears', async ({ page }) => {
    // Use ?delay=0 so the button appears immediately in CI
    await page.goto('/lca-healing-playground/timing.html?delay=0');
    await expect(page).toHaveTitle(/Late element/i);
    const checkout = page.locator('#checkout');
    await expect(checkout).toBeVisible({ timeout: 10000 });
  });
});

test.describe('frames.html — iframe', () => {
  test('loads and contains an iframe', async ({ page }) => {
    await page.goto('/lca-healing-playground/frames.html');
    await expect(page).toHaveTitle(/iFrame/i);
    const frame = page.locator('iframe#frame');
    await expect(frame).toBeAttached();
  });
});
