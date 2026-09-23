import { test, expect } from '@playwright/test';

// ── login.html ──────────────────────────────────────────────────────────────
test.describe('login.html — Sign-in form', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('https://aryan-stack012.github.io/lca-healing-playground/login.html');
  });

  test('sign-in form renders with username, password fields and submit button', async ({ page }) => {
    await expect(page.getByTestId('login-username')).toBeVisible();
    await expect(page.getByTestId('login-password')).toBeVisible();
    await expect(page.getByTestId('login-submit')).toBeVisible();
    await expect(page.getByTestId('login-toggle-password')).toBeVisible();
  });

  test('invalid credentials show an error message', async ({ page }) => {
    await page.getByTestId('login-username').fill('wronguser');
    await page.getByTestId('login-password').fill('wrongpassword');
    await page.getByTestId('login-submit').click();
    const errorEl = page.getByTestId('login-error');
    await expect(errorEl).toBeVisible();
    await expect(errorEl).toContainText('Invalid username or password.');
  });
});

// ── signup.html ──────────────────────────────────────────────────────────────
test.describe('signup.html — Registration form', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('https://aryan-stack012.github.io/lca-healing-playground/signup.html');
  });

  test('registration form renders with email, password, confirm-password fields and submit button', async ({ page }) => {
    await expect(page.getByTestId('signup-email')).toBeVisible();
    await expect(page.getByTestId('signup-password')).toBeVisible();
    await expect(page.getByTestId('signup-confirm-password')).toBeVisible();
    await expect(page.getByTestId('signup-submit')).toBeVisible();
  });

  test('all password policy rule indicators are visible', async ({ page }) => {
    await expect(page.getByTestId('signup-policy')).toBeVisible();
    await expect(page.getByTestId('policy-length')).toBeVisible();
    await expect(page.getByTestId('policy-upper')).toBeVisible();
    await expect(page.getByTestId('policy-lower')).toBeVisible();
    await expect(page.getByTestId('policy-digit')).toBeVisible();
    await expect(page.getByTestId('policy-special')).toBeVisible();
    await expect(page.getByTestId('policy-nospace')).toBeVisible();
    await expect(page.getByTestId('policy-noangle')).toBeVisible();
  });

  test('submitting empty form shows validation error', async ({ page }) => {
    await page.getByTestId('signup-submit').click();
    const errorEl = page.getByTestId('signup-error');
    await expect(errorEl).toBeVisible();
    await expect(errorEl).toContainText('Enter a valid email address.');
  });
});

// ── signin-email.html ────────────────────────────────────────────────────────
test.describe('signin-email.html — Email sign-in form', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('https://aryan-stack012.github.io/lca-healing-playground/signin-email.html');
  });

  test('email sign-in form renders with email, password fields and submit button', async ({ page }) => {
    await expect(page.getByTestId('signin-email')).toBeVisible();
    await expect(page.getByTestId('signin-password')).toBeVisible();
    await expect(page.getByTestId('signin-submit')).toBeVisible();
  });

  test('email field accepts a well-formed email address', async ({ page }) => {
    const emailInput = page.getByTestId('signin-email');
    await emailInput.fill('user@example.com');
    await expect(emailInput).toHaveValue('user@example.com');
  });
});

// ── inbox.html ───────────────────────────────────────────────────────────────
test.describe('inbox.html — Mailbox empty state', () => {
  test('shows empty-state message when opening an address with no mail', async ({ page }) => {
    await page.goto('https://aryan-stack012.github.io/lca-healing-playground/inbox.html?to=nobody@example.com');
    const emptyEl = page.getByTestId('inbox-empty');
    await expect(emptyEl).toBeVisible();
    await expect(emptyEl).toContainText('No messages for nobody@example.com');
  });
});
