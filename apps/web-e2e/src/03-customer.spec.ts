import { test, expect } from '@playwright/test';
import { selectSlot, signInAsCustomer, attachReceipt } from './support/ui';
import { stubGoogleSignIn } from './support/google';
import {
  createPendingBooking,
  listCourts,
  adminToken,
  nextWeekdayAt,
  provisionFacility,
} from './support/api';

/** Scenarios 1-8 — the customer-facing booking app. */

test.describe.configure({ mode: 'serial' });

test.beforeAll(async () => {
  await provisionFacility();
});

test('landing page renders and links to sign in', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toContainText(
    /pickleball|book a court/i,
  );
  await expect(page.getByRole('link', { name: /log in/i })).toBeVisible();
});

test('new customer signs in with Google, completes profile, accepts terms', async ({
  page,
}) => {
  await signInAsCustomer(page, {
    email: 'new.player@example.com',
    name: 'New Player',
    phone: '0917 123 4567',
  });

  // The court created during provisioning is visible, proving the whole
  // browser → API → database path.
  await expect(page.getByText('Center Court').first()).toBeVisible();
});

test('returning customer skips the profile and terms gates', async ({ page }) => {
  // Same identity as the previous test: the account already has a phone, so
  // needsProfile is false and the app goes straight to booking.
  await signInAsCustomer(page, {
    email: 'new.player@example.com',
    name: 'New Player',
  });
  await expect(page.getByText(/complete your profile/i)).toBeHidden();
});

test('a dismissed Google chooser reports an error instead of hanging', async ({
  page,
}) => {
  // Regression guard: the button used to sit on "Signing in…" forever when the
  // promise rejected, with nothing shown to the user.
  await stubGoogleSignIn(page, { cancel: true });
  await page.goto('/login');
  await page.getByRole('button', { name: /continue with google/i }).click();

  await expect(page.getByText(/didn't open|cancelled|try again/i)).toBeVisible();
  await expect(
    page.getByRole('button', { name: /continue with google/i }),
  ).toBeEnabled();
});

test('customer selects a slot and reaches checkout with the right total', async ({
  page,
}) => {
  const { date, hour } = nextWeekdayAt(18); // weekday evening → peak rate

  await signInAsCustomer(page, {
    email: 'booker@example.com',
    name: 'Booker',
    phone: '0917 222 3333',
  });

  await selectSlot(page, date, hour);

  // Peak rate is 700 for the provisioned court; the cart must reflect that
  // rather than the off-peak 450.
  await expect(page.getByText(/₱\s?700/).first()).toBeVisible();
  await page.getByRole('button', { name: /continue to payment/i }).click();
});

test('checkout holds the slot, shows the countdown and the facility payment methods', async ({
  page,
}) => {
  const { date, hour } = nextWeekdayAt(19);

  await signInAsCustomer(page, {
    email: 'holder@example.com',
    name: 'Holder',
    phone: '0917 444 5555',
  });
  await selectSlot(page, date, hour);
  await page.getByRole('button', { name: /continue to payment/i }).click();

  await expect(page.getByText(/your slots are held for/i)).toBeVisible();
  // Methods come from settings, not a hardcoded list.
  await expect(page.getByText('GCash').first()).toBeVisible();
  await expect(page.getByText('Cash').first()).toBeVisible();
});

test('uploading a receipt moves the booking to pending approval', async ({
  page,
}) => {
  const { date, hour } = nextWeekdayAt(20);

  await signInAsCustomer(page, {
    email: 'payer@example.com',
    name: 'Payer',
    phone: '0917 666 7777',
  });
  await selectSlot(page, date, hour);
  await page.getByRole('button', { name: /continue to payment/i }).click();

  await attachReceipt(page);
  await expect(page.getByText(/receipt attached/i)).toBeVisible();
  await page.getByRole('button', { name: /submit|pay/i }).first().click();

  await expect(page.getByText(/payment submitted/i)).toBeVisible();
});

test('my bookings lists the submitted booking', async ({ page }) => {
  await signInAsCustomer(page, {
    email: 'payer@example.com',
    name: 'Payer',
  });
  await page.getByText(/my bookings/i).first().click();
  await expect(page.getByText(/pending|awaiting/i).first()).toBeVisible();
});

test('a slot held by another customer is not bookable', async ({ page }) => {
  const token = await adminToken();
  const [court] = await listCourts(token);
  const { date, hour } = nextWeekdayAt(15);

  // Another customer takes the slot via the API — a second browser context
  // would be slower and prove nothing extra, since conflicts are enforced
  // server-side (assertSlotsFree → 409), not in the UI.
  await createPendingBooking({
    courtId: court.id,
    date,
    hour,
    email: 'first.holder@example.com',
  });

  await signInAsCustomer(page, {
    email: 'second.player@example.com',
    name: 'Second Player',
    phone: '0917 888 9999',
  });

  const cell = page.locator(`[data-slot="${date}|${hour}"]`);
  await expect(cell).toHaveAttribute('data-slot-state', /held|taken/);
});
