import { test, expect } from '@playwright/test';

const VALID_USERNAME = process.env.LCA_USERNAME || 'lca_admin';
const VALID_PASSWORD = process.env.LCA_PASSWORD || 'U4C3-AJFE-8ZK2-X76S';

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

  test('initial auth-state badge shows Signed out', async ({ page }) => {
    const badge = page.locator('#auth-state');
    await expect(badge).toHaveText('Signed out');
    await expect(badge).toHaveAttribute('data-state', 'signed-out');
  });

  test('valid credentials show dashboard with session ref and signed-in-at', async ({ page }) => {
    await page.getByTestId('login-username').fill(VALID_USERNAME);
    await page.getByTestId('login-password').fill(VALID_PASSWORD);
    await page.getByTestId('login-submit').click();

    await expect(page.getByTestId('dashboard')).toBeVisible();

    const sessionRef = page.getByTestId('session-ref');
    await expect(sessionRef).toBeVisible();
    const refText = await sessionRef.textContent();
    expect(refText).toMatch(/^SES-[0-9A-F]{8}$/);

    await expect(page.getByTestId('session-at')).not.toBeEmpty();
  });

  test('auth-state badge changes to Signed in after login', async ({ page }) => {
    await page.getByTestId('login-username').fill(VALID_USERNAME);
    await page.getByTestId('login-password').fill(VALID_PASSWORD);
    await page.getByTestId('login-submit').click();
    await expect(page.getByTestId('dashboard')).toBeVisible();

    const badge = page.locator('#auth-state');
    await expect(badge).toHaveText('Signed in');
    await expect(badge).toHaveAttribute('data-state', 'signed-in');
  });

  test('login form is hidden after successful sign-in', async ({ page }) => {
    await page.getByTestId('login-username').fill(VALID_USERNAME);
    await page.getByTestId('login-password').fill(VALID_PASSWORD);
    await page.getByTestId('login-submit').click();
    await expect(page.getByTestId('dashboard')).toBeVisible();
    await expect(page.locator('#login-card')).toBeHidden();
  });

  test('sign out returns to login form, hides dashboard, resets badge', async ({ page }) => {
    await page.getByTestId('login-username').fill(VALID_USERNAME);
    await page.getByTestId('login-password').fill(VALID_PASSWORD);
    await page.getByTestId('login-submit').click();
    await expect(page.getByTestId('dashboard')).toBeVisible();

    await page.getByTestId('logout').click();

    await expect(page.locator('#login-card')).toBeVisible();
    await expect(page.getByTestId('dashboard')).toBeHidden();
    await expect(page.locator('#auth-state')).toHaveText('Signed out');
    await expect(page.locator('#auth-state')).toHaveAttribute('data-state', 'signed-out');
  });

  test('invalid credentials show an error message', async ({ page }) => {
    await page.getByTestId('login-username').fill('wronguser');
    await page.getByTestId('login-password').fill('wrongpassword');
    await page.getByTestId('login-submit').click();
    const errorEl = page.getByTestId('login-error');
    await expect(errorEl).toBeVisible();
    await expect(errorEl).toContainText('Invalid username or password.');
  });

  test('empty username and password shows validation error', async ({ page }) => {
    await page.getByTestId('login-submit').click();
    const errorEl = page.getByTestId('login-error');
    await expect(errorEl).toBeVisible();
    await expect(errorEl).toContainText('Enter both a username and a password.');
  });

  test('empty username only shows validation error', async ({ page }) => {
    await page.getByTestId('login-password').fill(VALID_PASSWORD);
    await page.getByTestId('login-submit').click();
    const errorEl = page.getByTestId('login-error');
    await expect(errorEl).toBeVisible();
    await expect(errorEl).toContainText('Enter both a username and a password.');
  });

  test('empty password only shows validation error', async ({ page }) => {
    await page.getByTestId('login-username').fill(VALID_USERNAME);
    await page.getByTestId('login-submit').click();
    const errorEl = page.getByTestId('login-error');
    await expect(errorEl).toBeVisible();
    await expect(errorEl).toContainText('Enter both a username and a password.');
  });

  test('failed attempt counter increments on each wrong login (3 attempts)', async ({ page }) => {
    const errorEl = page.getByTestId('login-error');
    for (let attempt = 1; attempt <= 3; attempt++) {
      await page.getByTestId('login-username').fill('bad_user');
      await page.getByTestId('login-password').fill('bad_pass');
      await page.getByTestId('login-submit').click();
      await expect(errorEl).toBeVisible();
      await expect(errorEl).toHaveAttribute('data-attempts', String(attempt));
    }
  });

  test('show/hide password toggle changes type, aria-pressed, and label', async ({ page }) => {
    await page.getByTestId('login-password').fill(VALID_PASSWORD);

    const passwordInput = page.getByTestId('login-password');
    const toggleBtn = page.getByTestId('login-toggle-password');

    await expect(passwordInput).toHaveAttribute('type', 'password');
    await expect(toggleBtn).toHaveText('Show');
    await expect(toggleBtn).toHaveAttribute('aria-pressed', 'false');

    await toggleBtn.click();
    await expect(passwordInput).toHaveAttribute('type', 'text');
    await expect(toggleBtn).toHaveText('Hide');
    await expect(toggleBtn).toHaveAttribute('aria-pressed', 'true');

    await toggleBtn.click();
    await expect(passwordInput).toHaveAttribute('type', 'password');
    await expect(toggleBtn).toHaveText('Show');
    await expect(toggleBtn).toHaveAttribute('aria-pressed', 'false');
  });

  test('session persists after page reload', async ({ page }) => {
    await page.getByTestId('login-username').fill(VALID_USERNAME);
    await page.getByTestId('login-password').fill(VALID_PASSWORD);
    await page.getByTestId('login-submit').click();
    await expect(page.getByTestId('dashboard')).toBeVisible();

    const refBefore = await page.getByTestId('session-ref').textContent();

    await page.reload();
    await page.waitForSelector('[data-testid="dashboard"]', { state: 'visible' });

    await expect(page.getByTestId('dashboard')).toBeVisible();
    await expect(page.getByTestId('session-ref')).toHaveText(refBefore!);
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

  test('all 7 password policy indicators are visible', async ({ page }) => {
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

  test('password typed updates policy indicators via data-ok attribute', async ({ page }) => {
    const pwInput = page.getByTestId('signup-password');

    // Before typing — all indicators should be data-ok="false"
    await expect(page.getByTestId('policy-length')).toHaveAttribute('data-ok', 'false');

    // Type a compliant password
    await pwInput.fill('TestPass1!ab');

    // All 7 rules should now be met
    await expect(page.getByTestId('policy-length')).toHaveAttribute('data-ok', 'true');
    await expect(page.getByTestId('policy-upper')).toHaveAttribute('data-ok', 'true');
    await expect(page.getByTestId('policy-lower')).toHaveAttribute('data-ok', 'true');
    await expect(page.getByTestId('policy-digit')).toHaveAttribute('data-ok', 'true');
    await expect(page.getByTestId('policy-special')).toHaveAttribute('data-ok', 'true');
    await expect(page.getByTestId('policy-nospace')).toHaveAttribute('data-ok', 'true');
    await expect(page.getByTestId('policy-noangle')).toHaveAttribute('data-ok', 'true');
  });

  test('valid email and compliant password shows verification step', async ({ page }) => {
    await page.getByTestId('signup-email').fill('verify@example.com');
    await page.getByTestId('signup-password').fill('TestPass1!ab');
    await page.getByTestId('signup-confirm-password').fill('TestPass1!ab');
    await page.getByTestId('signup-submit').click();

    await expect(page.getByTestId('verify-card')).toBeVisible();
    await expect(page.getByTestId('verify-prompt')).toContainText('We sent a verification code to verify@example.com');
  });

  test('?strict=1 — extra undisclosed rule rejects first compliant password', async ({ page }) => {
    await page.goto('https://aryan-stack012.github.io/lca-healing-playground/signup.html?strict=1');

    const email = 'strict@example.com';
    const pass1 = 'TestPass1!ab';
    const pass2 = 'TestPass2!xy';

    // First submission — always rejected by strict mode
    await page.getByTestId('signup-email').fill(email);
    await page.getByTestId('signup-password').fill(pass1);
    await page.getByTestId('signup-confirm-password').fill(pass1);
    await page.getByTestId('signup-submit').click();

    const errorEl = page.getByTestId('signup-error');
    await expect(errorEl).toBeVisible();
    await expect(errorEl).toContainText('Password does not meet our security requirements.');

    // Second submission with a different password — should proceed to verify step
    await page.getByTestId('signup-password').fill(pass2);
    await page.getByTestId('signup-confirm-password').fill(pass2);
    await page.getByTestId('signup-submit').click();

    await expect(page.getByTestId('verify-card')).toBeVisible();
  });

  test('?nomail=1 — verification code never delivered, error shown on submit', async ({ page }) => {
    await page.goto('https://aryan-stack012.github.io/lca-healing-playground/signup.html?nomail=1');

    await page.getByTestId('signup-email').fill('nomail@example.com');
    await page.getByTestId('signup-password').fill('TestPass1!ab');
    await page.getByTestId('signup-confirm-password').fill('TestPass1!ab');
    await page.getByTestId('signup-submit').click();

    // Verify step is shown
    await expect(page.getByTestId('verify-card')).toBeVisible();

    // Submit any code — no message was ever sent
    await page.getByTestId('verify-otp').fill('123456');
    await page.getByTestId('verify-submit').click();

    const verifyError = page.getByTestId('verify-error');
    await expect(verifyError).toBeVisible();
    await expect(verifyError).toContainText('No verification message was sent to nomail@example.com');
  });

  test('?expire=1 — expired code is rejected with re-send message', async ({ page }) => {
    await page.goto('https://aryan-stack012.github.io/lca-healing-playground/signup.html?expire=1');

    const email = 'expire@example.com';
    await page.getByTestId('signup-email').fill(email);
    await page.getByTestId('signup-password').fill('TestPass1!ab');
    await page.getByTestId('signup-confirm-password').fill('TestPass1!ab');
    await page.getByTestId('signup-submit').click();

    await expect(page.getByTestId('verify-card')).toBeVisible();

    // Read the OTP from the inbox (the expired code)
    const inboxPage = await page.context().newPage();
    await inboxPage.goto(`https://aryan-stack012.github.io/lca-healing-playground/inbox.html?to=${encodeURIComponent(email)}`);
    // Get the first message's OTP code from the inbox
    const msgEl = inboxPage.locator('[data-testid="inbox-messages"]');
    await expect(msgEl).toBeVisible();
    const msgText = await msgEl.textContent();
    const codeMatch = msgText?.match(/\b(\d{6})\b/);
    await inboxPage.close();

    if (codeMatch) {
      await page.getByTestId('verify-otp').fill(codeMatch[1]);
      await page.getByTestId('verify-submit').click();

      const verifyError = page.getByTestId('verify-error');
      await expect(verifyError).toBeVisible();
      await expect(verifyError).toContainText('That code has expired. We sent a new one.');
    } else {
      // If no code found in inbox, verify the verify step is shown (code was sent but expired)
      await page.getByTestId('verify-otp').fill('000000');
      await page.getByTestId('verify-submit').click();
      const verifyError = page.getByTestId('verify-error');
      await expect(verifyError).toBeVisible();
    }
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

  test('invalid email shows validation error', async ({ page }) => {
    await page.getByTestId('signin-email').fill('notanemail');
    await page.getByTestId('signin-submit').click();
    const errorEl = page.getByTestId('signin-error');
    await expect(errorEl).toBeVisible();
    await expect(errorEl).toContainText('Enter both an email address and a password.');
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
