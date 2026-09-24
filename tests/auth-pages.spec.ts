import { test, expect } from '@playwright/test';

const BASE = 'https://aryan-stack012.github.io/lca-healing-playground';
const VALID_PASSWORD = 'Password1!';

// ── signup.html ──────────────────────────────────────────────────────────────
test.describe('signup.html — Registration form', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE}/signup.html`);
  });

  test('form renders with email, password, confirm-password fields and submit button', async ({ page }) => {
    await expect(page.getByTestId('signup-email')).toBeVisible();
    await expect(page.getByTestId('signup-password')).toBeVisible();
    await expect(page.getByTestId('signup-confirm-password')).toBeVisible();
    await expect(page.getByTestId('signup-submit')).toBeVisible();
  });

  test('page title is "Create account · LCA Playground"', async ({ page }) => {
    await expect(page).toHaveTitle('Create account · LCA Playground');
  });

  test('password policy list renders 7 rules initially unmet', async ({ page }) => {
    const items = page.locator('.policy li');
    await expect(items).toHaveCount(7);
    // All rules start unmet (data-ok not "true")
    const firstItem = items.first();
    await expect(firstItem).not.toHaveAttribute('data-ok', 'true');
  });

  test('typing a valid password marks all 7 policy rules as met', async ({ page }) => {
    await page.getByTestId('signup-password').fill(VALID_PASSWORD);
    const items = page.locator('.policy li[data-ok="true"]');
    await expect(items).toHaveCount(7);
  });

  test('show/hide password toggle changes input type', async ({ page }) => {
    const pwInput = page.getByTestId('signup-password');
    await expect(pwInput).toHaveAttribute('type', 'password');
    await page.locator('button:has-text("Show")').first().click();
    await expect(pwInput).toHaveAttribute('type', 'text');
    await page.locator('button:has-text("Hide")').first().click();
    await expect(pwInput).toHaveAttribute('type', 'password');
  });

  test('valid registration shows email verification section', async ({ page }) => {
    await page.getByTestId('signup-email').fill('test@example.com');
    await page.getByTestId('signup-password').fill(VALID_PASSWORD);
    await page.getByTestId('signup-confirm-password').fill(VALID_PASSWORD);
    await page.getByTestId('signup-submit').click();
    await expect(page.locator('h2:has-text("Verify your email")')).toBeVisible();
    await expect(page.getByTestId('verify-otp')).toBeVisible();
    await expect(page.getByTestId('verify-submit')).toBeVisible();
  });

  test('inbox link appears after registration', async ({ page }) => {
    await page.getByTestId('signup-email').fill('test@example.com');
    await page.getByTestId('signup-password').fill(VALID_PASSWORD);
    await page.getByTestId('signup-confirm-password').fill(VALID_PASSWORD);
    await page.getByTestId('signup-submit').click();
    await expect(page.getByTestId('inbox-link')).toBeVisible();
  });

  test('password mismatch shows error', async ({ page }) => {
    await page.getByTestId('signup-email').fill('test@example.com');
    await page.getByTestId('signup-password').fill(VALID_PASSWORD);
    await page.getByTestId('signup-confirm-password').fill('DifferentPass1!');
    await page.getByTestId('signup-submit').click();
    await expect(page.locator('#signup-error')).not.toBeEmpty();
  });

  test('empty email shows error', async ({ page }) => {
    await page.getByTestId('signup-password').fill(VALID_PASSWORD);
    await page.getByTestId('signup-confirm-password').fill(VALID_PASSWORD);
    await page.getByTestId('signup-submit').click();
    await expect(page.locator('#signup-error')).not.toBeEmpty();
  });

  test('password failing policy shows error on submit', async ({ page }) => {
    await page.getByTestId('signup-email').fill('test@example.com');
    await page.getByTestId('signup-password').fill('short');
    await page.getByTestId('signup-confirm-password').fill('short');
    await page.getByTestId('signup-submit').click();
    await expect(page.locator('#signup-error')).not.toBeEmpty();
  });

  test('?nomail=1: registration succeeds but email delivery note shown', async ({ page }) => {
    await page.goto(`${BASE}/signup.html?nomail=1`);
    await page.getByTestId('signup-email').fill('test@example.com');
    await page.getByTestId('signup-password').fill(VALID_PASSWORD);
    await page.getByTestId('signup-confirm-password').fill(VALID_PASSWORD);
    await page.getByTestId('signup-submit').click();
    // Verify section still appears even when mail is not delivered
    await expect(page.locator('h2:has-text("Verify your email")')).toBeVisible();
  });

  test('?expire=1: verification code input is shown but code is expired', async ({ page }) => {
    await page.goto(`${BASE}/signup.html?expire=1`);
    await page.getByTestId('signup-email').fill('test@example.com');
    await page.getByTestId('signup-password').fill(VALID_PASSWORD);
    await page.getByTestId('signup-confirm-password').fill(VALID_PASSWORD);
    await page.getByTestId('signup-submit').click();
    await expect(page.getByTestId('verify-otp')).toBeVisible();
    // Submitting any code should show an error (expired)
    await page.getByTestId('verify-otp').fill('000000');
    await page.getByTestId('verify-submit').click();
    await expect(page.getByTestId('verify-error')).not.toBeEmpty();
  });

  test('?link=1: link-based verification — inbox link is shown', async ({ page }) => {
    await page.goto(`${BASE}/signup.html?link=1`);
    await page.getByTestId('signup-email').fill('test@example.com');
    await page.getByTestId('signup-password').fill(VALID_PASSWORD);
    await page.getByTestId('signup-confirm-password').fill(VALID_PASSWORD);
    await page.getByTestId('signup-submit').click();
    await expect(page.getByTestId('inbox-link')).toBeVisible();
  });
});

// ── signin-email.html ────────────────────────────────────────────────────────
test.describe('signin-email.html — Email sign-in form', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE}/signin-email.html`);
  });

  test('form renders with email, password fields and sign-in button', async ({ page }) => {
    await expect(page.getByTestId('signin-email')).toBeVisible();
    await expect(page.getByTestId('signin-password')).toBeVisible();
    await expect(page.getByTestId('signin-submit')).toBeVisible();
  });

  test('page title is "Email sign-in · LCA Playground"', async ({ page }) => {
    await expect(page).toHaveTitle('Email sign-in · LCA Playground');
  });

  test('valid email and password signs in and shows dashboard', async ({ page }) => {
    await page.getByTestId('signin-email').fill('test@example.com');
    await page.getByTestId('signin-password').fill('U4C3-AJFE-8ZK2-X76S');
    await page.getByTestId('signin-submit').click();
    await expect(page.locator('h2:has-text("Signed in")')).toBeVisible();
    await expect(page.locator('#session-ref')).toBeVisible();
  });

  test('session ref matches SES-XXXXXXXX pattern after sign-in', async ({ page }) => {
    await page.getByTestId('signin-email').fill('test@example.com');
    await page.getByTestId('signin-password').fill('U4C3-AJFE-8ZK2-X76S');
    await page.getByTestId('signin-submit').click();
    await expect(page.locator('h2:has-text("Signed in")')).toBeVisible();
    const ref = await page.locator('#session-ref').textContent();
    expect(ref).toMatch(/^SES-[0-9A-F]{8}$/);
  });

  test('sign out returns to sign-in form', async ({ page }) => {
    await page.getByTestId('signin-email').fill('test@example.com');
    await page.getByTestId('signin-password').fill('U4C3-AJFE-8ZK2-X76S');
    await page.getByTestId('signin-submit').click();
    await expect(page.locator('h2:has-text("Signed in")')).toBeVisible();
    await page.getByTestId('logout').click();
    await expect(page.getByTestId('signin-email')).toBeVisible();
  });

  test('invalid credentials show error message', async ({ page }) => {
    await page.getByTestId('signin-email').fill('wrong@example.com');
    await page.getByTestId('signin-password').fill('wrongpassword');
    await page.getByTestId('signin-submit').click();
    await expect(page.locator('#signin-error')).not.toBeEmpty();
  });

  test('empty email shows error', async ({ page }) => {
    await page.getByTestId('signin-password').fill('U4C3-AJFE-8ZK2-X76S');
    await page.getByTestId('signin-submit').click();
    await expect(page.locator('#signin-error')).not.toBeEmpty();
  });

  test('show/hide password toggle changes input type', async ({ page }) => {
    const pwInput = page.getByTestId('signin-password');
    await expect(pwInput).toHaveAttribute('type', 'password');
    await page.getByTestId('signin-toggle-password').click();
    await expect(pwInput).toHaveAttribute('type', 'text');
  });

  test('?otp=1: OTP challenge input appears after sign-in', async ({ page }) => {
    await page.goto(`${BASE}/signin-email.html?otp=1`);
    await page.getByTestId('signin-email').fill('test@example.com');
    await page.getByTestId('signin-password').fill('U4C3-AJFE-8ZK2-X76S');
    await page.getByTestId('signin-submit').click();
    await expect(page.getByTestId('challenge-code')).toBeVisible();
  });

  test('?link=1: link-based sign-in shows inbox link', async ({ page }) => {
    await page.goto(`${BASE}/signin-email.html?link=1`);
    await page.getByTestId('signin-email').fill('test@example.com');
    await page.getByTestId('signin-password').fill('U4C3-AJFE-8ZK2-X76S');
    await page.getByTestId('signin-submit').click();
    await expect(page.getByTestId('inbox-link')).toBeVisible();
  });
});
