// @ts-check
const { test, expect } = require('@playwright/test');

const SIGNIN_URL = 'https://aryan-stack012.github.io/lca-healing-playground/signin-email.html';
const SHARED_PASSWORD = process.env.LCA_SHARED_PASSWORD || 'U4C3-AJFE-8ZK2-X76S';

test.describe('Signin-email', () => {

  // ── Happy path ──────────────────────────────────────────────────────────────

  test('Signin-email happy path — sign in with shared password (no MFA) TC-3512', async ({ page }) => {
    await page.goto(SIGNIN_URL);
    await page.waitForSelector('[data-testid="signin-email"]', { state: 'visible' });

    // Step 1: Enter any well-formed email in the email field
    await page.fill('[data-testid="signin-email"]', 'user@example.com');

    // Step 2: Enter the correct shared password
    await page.fill('[data-testid="signin-password"]', SHARED_PASSWORD);

    // Step 3: Click 'Sign in' — button shows 'Signing in…' briefly during derivation,
    // then the dashboard appears on success
    await page.click('[data-testid="signin-submit"]');

    // Dashboard should appear — verifies sign-in succeeded
    await expect(page.locator('[data-testid="signin-dashboard"]')).toBeVisible();

    // Status text confirms the signed-in identity
    await expect(page.locator('[data-testid="signin-status"]')).toHaveText('Signed in as user@example.com');

    // Auth state badge reflects signed-in state
    await expect(page.locator('#auth-state')).toHaveText('Signed in');
    await expect(page.locator('#auth-state')).toHaveAttribute('data-state', 'signed-in');

    // Session ref is populated (format: SES-XXXXXXXX)
    const sessionRef = page.locator('[data-testid="session-ref"]');
    await expect(sessionRef).toBeVisible();
    const refText = await sessionRef.textContent();
    expect(refText).toMatch(/^SES-[0-9A-F]{8}$/);

    // Credential source confirms shared password was used (no MFA)
    await expect(page.locator('[data-testid="session-credential"]')).toHaveText('shared password');

    // Sign-in form is hidden after successful login
    await expect(page.locator('#signin-card')).toBeHidden();
  });

});
