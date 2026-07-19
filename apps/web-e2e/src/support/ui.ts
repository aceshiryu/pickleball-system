import { expect, type Page } from '@playwright/test';
import { ADMIN_EMAIL, ADMIN_PASSWORD } from './api';
import { stubGoogleSignIn } from './google';

/**
 * Browser-level helpers shared across specs. These drive the real UI — they are
 * not shortcuts around it. (For shortcuts, see support/api.ts.)
 */

/**
 * Sign in to the admin console by typing the credentials.
 *
 * Deliberately does NOT use the local-only "Sample login" button or the
 * prefilled fields: those are dev affordances slated for removal, and a suite
 * that depends on them would break the moment the console is production-ready.
 */
export async function signInAsAdmin(page: Page): Promise<void> {
  await page.goto('/admin/login');
  await expect(page.getByText(/staff sign in/i)).toBeVisible();

  const email = page.locator('input').first();
  const password = page.locator('input[type="password"]');
  await email.fill(ADMIN_EMAIL);
  await password.fill(ADMIN_PASSWORD);

  await page.getByRole('button', { name: /^sign in to admin$/i }).click();
  await expect(page.getByRole('heading', { name: /dashboard/i })).toBeVisible();
}

export interface CustomerSignInOptions {
  email: string;
  name?: string;
  /** New accounts must supply a phone; returning ones skip that screen. */
  phone?: string;
  /** First-time accounts also hit the terms gate. */
  acceptTerms?: boolean;
}

/** Sign a customer in through the stubbed Google chooser and clear the gates. */
export async function signInAsCustomer(
  page: Page,
  opts: CustomerSignInOptions,
): Promise<void> {
  await stubGoogleSignIn(page, { email: opts.email, name: opts.name });
  await page.goto('/login');
  await page.getByRole('button', { name: /continue with google/i }).click();

  if (opts.phone) {
    await expect(page.getByText(/complete your profile/i)).toBeVisible();
    await page.getByPlaceholder('0917 000 0000').fill(opts.phone);
    await page.getByRole('button', { name: /^continue$/i }).click();
  }

  if (opts.acceptTerms !== false) {
    // The checkbox is a custom control: the first span inside the label.
    const terms = page.locator('label', { hasText: /i have read and agree/i });
    if (await terms.isVisible().catch(() => false)) {
      await terms.locator('span').first().click();
      await page.getByRole('button', { name: /accept & continue/i }).click();
    }
  }

  await expect(page.getByRole('heading', { name: /book a court/i })).toBeVisible();
}

/**
 * Select a slot in the week grid.
 *
 * Selection is mousedown/mouseup driven (the grid supports drag-select), so a
 * plain click doesn't always register — this presses and releases explicitly.
 * If the date isn't in the visible week, it pages forward once and retries.
 */
export async function selectSlot(
  page: Page,
  date: string,
  hour: number,
): Promise<void> {
  const cell = page.locator(`[data-slot="${date}|${hour}"]`);

  if ((await cell.count()) === 0) {
    await page.getByRole('button', { name: '›' }).click();
    await expect(cell).toHaveCount(1);
  }

  await expect(cell).toHaveAttribute('data-slot-state', /peak|off/);
  await cell.hover();
  await page.mouse.down();
  await page.mouse.up();
  await expect(cell).toHaveAttribute('data-slot-selected', 'true');
}

/** Assert a slot is present but not bookable (held, taken or blocked). */
export async function expectSlotUnavailable(
  page: Page,
  date: string,
  hour: number,
): Promise<void> {
  const cell = page.locator(`[data-slot="${date}|${hour}"]`);
  await expect(cell).toHaveAttribute('data-slot-state', /held|taken|blocked/);
}

/** Navigate the admin console via its left nav. */
export async function gotoAdminSection(
  page: Page,
  label: RegExp,
): Promise<void> {
  await page.getByText(label).first().click();
}

/**
 * Attach a receipt to the file input behind "Tap to upload a screenshot".
 * The input is display:none, so setInputFiles is the only route in.
 */
export async function attachReceipt(page: Page): Promise<void> {
  await page.locator('input[type="file"]').first().setInputFiles({
    name: 'receipt.png',
    mimeType: 'image/png',
    // Smallest valid PNG — the API validates the data URL prefix, not pixels.
    buffer: Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
      'base64',
    ),
  });
}
