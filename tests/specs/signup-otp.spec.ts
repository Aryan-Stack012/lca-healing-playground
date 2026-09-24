import { test, expect } from '@playwright/test';

// T-042369773: Signup verify card — wrong OTP code rejected
// Precondition: complete signup form with valid data to reach the verify card.
// A real OTP is sent to the in-browser mailbox; we deliberately enter the wrong code.

test.describe('signup.html — OTP verification', () => {
  test('wrong OTP code is rejected with mismatch error (T-042369773)', async ({ page }) => {
    await page.goto('/signup.html');

    // Use a unique email per run so the account is always fresh
    const email = `testuser_${Date.now()}@example.com`;
    const password = 'ValidPass1!';

    // Fill signup form
    await page.getByTestId('signup-email').fill(email);
    await page.getByTestId('signup-password').fill(password);
    await page.getByTestId('signup-confirm-password').fill(password);
    await page.getByTestId('signup-submit').click();

    // Verify card should now be visible
    await expect(page.getByTestId('verify-card')).toBeVisible();

    // Enter wrong OTP code
    await page.getByTestId('verify-otp').fill('000000');
    await page.getByTestId('verify-submit').click();

    // Error message should appear
    const verifyError = page.getByTestId('verify-error');
    await expect(verifyError).toBeVisible();
    await expect(verifyError).toHaveText('That code is not correct.');
    await expect(verifyError).toHaveAttribute('data-reason', 'otp_mismatch');
  });
});
