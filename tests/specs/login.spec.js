// @ts-check
const { test, expect } = require('@playwright/test');

const LOGIN_URL = 'https://aryan-stack012.github.io/lca-healing-playground/login.html';
const VALID_USERNAME = process.env.LCA_USERNAME || 'lca_admin';
const VALID_PASSWORD = process.env.LCA_PASSWORD || 'U4C3-AJFE-8ZK2-X76S';

test.describe('Login Page', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto(LOGIN_URL);
    // Wait for the login form to be visible
    await page.waitForSelector('[data-testid="login-username"]', { state: 'visible' });
  });

  // ── Happy path ──────────────────────────────────────────────────────────────

  test('successful login with valid credentials shows dashboard', async ({ page }) => {
    await page.fill('[data-testid="login-username"]', VALID_USERNAME);
    await page.fill('[data-testid="login-password"]', VALID_PASSWORD);
    await page.click('[data-testid="login-submit"]');

    // Dashboard should appear
    await expect(page.locator('[data-testid="dashboard"]')).toBeVisible();

    // Login status shows the correct username
    await expect(page.locator('[data-testid="login-status"]')).toHaveText(
      `Signed in as ${VALID_USERNAME}`
    );

    // Auth state badge should read "Signed in"
    await expect(page.locator('#auth-state')).toHaveText('Signed in');
    await expect(page.locator('#auth-state')).toHaveAttribute('data-state', 'signed-in');

    // Session ref is populated (format: SES-XXXXXXXX)
    const sessionRef = page.locator('[data-testid="session-ref"]');
    await expect(sessionRef).toBeVisible();
    const refText = await sessionRef.textContent();
    expect(refText).toMatch(/^SES-[0-9A-F]{8}$/);

    // Signed-in-at timestamp is populated
    await expect(page.locator('[data-testid="session-at"]')).not.toBeEmpty();

    // Login form is hidden
    await expect(page.locator('#login-card')).toBeHidden();
  });

  // ── Sign-out ─────────────────────────────────────────────────────────────────

  test('sign out after successful login returns to login form', async ({ page }) => {
    // Log in first
    await page.fill('[data-testid="login-username"]', VALID_USERNAME);
    await page.fill('[data-testid="login-password"]', VALID_PASSWORD);
    await page.click('[data-testid="login-submit"]');
    await expect(page.locator('[data-testid="dashboard"]')).toBeVisible();

    // Sign out
    await page.click('[data-testid="logout"]');

    // Login form should reappear
    await expect(page.locator('#login-card')).toBeVisible();
    await expect(page.locator('[data-testid="dashboard"]')).toBeHidden();

    // Auth state badge should read "Signed out"
    await expect(page.locator('#auth-state')).toHaveText('Signed out');
    await expect(page.locator('#auth-state')).toHaveAttribute('data-state', 'signed-out');
  });

  // ── Error cases ──────────────────────────────────────────────────────────────

  test('invalid credentials show error message', async ({ page }) => {
    await page.fill('[data-testid="login-username"]', 'wrong_user');
    await page.fill('[data-testid="login-password"]', 'wrong_password');
    await page.click('[data-testid="login-submit"]');

    const errorEl = page.locator('[data-testid="login-error"]');
    await expect(errorEl).toBeVisible();
    await expect(errorEl).toHaveText('Invalid username or password.');

    // Attempt counter increments
    await expect(errorEl).toHaveAttribute('data-attempts', '1');

    // Dashboard remains hidden
    await expect(page.locator('[data-testid="dashboard"]')).toBeHidden();
  });

  test('empty username and password shows validation error', async ({ page }) => {
    await page.click('[data-testid="login-submit"]');

    const errorEl = page.locator('[data-testid="login-error"]');
    await expect(errorEl).toBeVisible();
    await expect(errorEl).toHaveText('Enter both a username and a password.');
  });

  test('empty username only shows validation error', async ({ page }) => {
    await page.fill('[data-testid="login-password"]', VALID_PASSWORD);
    await page.click('[data-testid="login-submit"]');

    const errorEl = page.locator('[data-testid="login-error"]');
    await expect(errorEl).toBeVisible();
    await expect(errorEl).toHaveText('Enter both a username and a password.');
  });

  test('empty password only shows validation error', async ({ page }) => {
    await page.fill('[data-testid="login-username"]', VALID_USERNAME);
    await page.click('[data-testid="login-submit"]');

    const errorEl = page.locator('[data-testid="login-error"]');
    await expect(errorEl).toBeVisible();
    await expect(errorEl).toHaveText('Enter both a username and a password.');
  });

  test('failed attempt counter increments on each wrong login', async ({ page }) => {
    for (let attempt = 1; attempt <= 3; attempt++) {
      await page.fill('[data-testid="login-username"]', 'bad_user');
      await page.fill('[data-testid="login-password"]', 'bad_pass');
      await page.click('[data-testid="login-submit"]');

      const errorEl = page.locator('[data-testid="login-error"]');
      await expect(errorEl).toBeVisible();
      await expect(errorEl).toHaveAttribute('data-attempts', String(attempt));
    }
  });

  // ── Password visibility toggle ───────────────────────────────────────────────

  test('show/hide password toggle changes input type', async ({ page }) => {
    await page.fill('[data-testid="login-password"]', VALID_PASSWORD);

    const passwordInput = page.locator('[data-testid="login-password"]');
    const toggleBtn = page.locator('[data-testid="login-toggle-password"]');

    // Initially password is hidden
    await expect(passwordInput).toHaveAttribute('type', 'password');
    await expect(toggleBtn).toHaveText('Show');
    await expect(toggleBtn).toHaveAttribute('aria-pressed', 'false');

    // Click Show — password becomes visible
    await toggleBtn.click();
    await expect(passwordInput).toHaveAttribute('type', 'text');
    await expect(toggleBtn).toHaveText('Hide');
    await expect(toggleBtn).toHaveAttribute('aria-pressed', 'true');

    // Click Hide — password is hidden again
    await toggleBtn.click();
    await expect(passwordInput).toHaveAttribute('type', 'password');
    await expect(toggleBtn).toHaveText('Show');
    await expect(toggleBtn).toHaveAttribute('aria-pressed', 'false');
  });

  // ── Session persistence ──────────────────────────────────────────────────────

  test('session persists after page reload', async ({ page }) => {
    // Log in
    await page.fill('[data-testid="login-username"]', VALID_USERNAME);
    await page.fill('[data-testid="login-password"]', VALID_PASSWORD);
    await page.click('[data-testid="login-submit"]');
    await expect(page.locator('[data-testid="dashboard"]')).toBeVisible();

    // Capture session ref before reload
    const refBefore = await page.locator('[data-testid="session-ref"]').textContent();

    // Reload the page
    await page.reload();
    await page.waitForSelector('[data-testid="dashboard"]', { state: 'visible' });

    // Dashboard should still be visible with the same session ref
    await expect(page.locator('[data-testid="dashboard"]')).toBeVisible();
    await expect(page.locator('[data-testid="session-ref"]')).toHaveText(refBefore);
  });

  // ── Page structure ───────────────────────────────────────────────────────────

  test('login page has correct initial state', async ({ page }) => {
    // Login form is visible, dashboard is hidden
    await expect(page.locator('#login-card')).toBeVisible();
    await expect(page.locator('[data-testid="dashboard"]')).toBeHidden();

    // Auth state badge shows "Signed out"
    await expect(page.locator('#auth-state')).toHaveText('Signed out');
    await expect(page.locator('#auth-state')).toHaveAttribute('data-state', 'signed-out');

    // Error element is empty initially
    await expect(page.locator('[data-testid="login-error"]')).toBeEmpty();

    // Submit button is present and enabled
    await expect(page.locator('[data-testid="login-submit"]')).toBeEnabled();
  });

});
