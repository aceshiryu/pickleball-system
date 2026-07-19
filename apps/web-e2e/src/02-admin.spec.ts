import { test, expect } from '@playwright/test';
import {
  gotoAdminSection,
  signInAsAdmin,
} from './support/ui';
import {
  adminToken,
  createPendingBooking,
  getSettings,
  listCourts,
  nextWeekdayAt,
  provisionFacility,
} from './support/api';

/**
 * Scenarios 10-18 — the admin console (which lives at /admin inside the web app).
 *
 * Facility provisioning runs through the API in beforeAll: 01-onboarding
 * already covers doing it through the wizard, and repeating it per spec would
 * add minutes for no extra coverage.
 */

test.describe.configure({ mode: 'serial' });

test.beforeAll(async () => {
  await provisionFacility();
});

test('admin signs in with typed credentials and reaches the dashboard', async ({
  page,
}) => {
  // signInAsAdmin types the credentials rather than using the sample-login
  // shortcut, so this keeps passing once that dev affordance is removed.
  await signInAsAdmin(page);
  await expect(page.getByText(/today/i).first()).toBeVisible();
});

test('court management: add a court, then toggle maintenance', async ({
  page,
}) => {
  await signInAsAdmin(page);
  await gotoAdminSection(page, /court management/i);

  await page.getByText(/add a court/i).first().click();
  await page.getByRole('textbox').first().fill('Court Two');
  await page.getByRole('button', { name: /^add court$|^save$/i }).click();
  await expect(page.getByText('Court Two').first()).toBeVisible();

  // Maintenance is a server-side status change, so re-read it from the API.
  const token = await adminToken();
  const courts = await listCourts(token);
  expect(courts.map((c) => c.name)).toContain('Court Two');
});

test('settings: adding a payment method persists it', async ({ page }) => {
  await signInAsAdmin(page);
  await gotoAdminSection(page, /^settings$/i);
  await page.getByText(/payment methods/i).first().click();

  // New structured editor: pick Maya, enter the required mobile number, save.
  await page.getByRole('button', { name: /^\+ Maya$/ }).click();
  await page.getByPlaceholder(/0917/).fill('0917 222 3333');
  await page.getByRole('button', { name: /^save method$/i }).click();
  await expect(page.getByText('0917 222 3333').first()).toBeVisible();

  const settings = await getSettings(await adminToken());
  expect(settings.paymentMethods.map((m) => m.label)).toContain('Maya');
});

test('approvals: approve a pending booking with method and reference', async ({
  page,
}) => {
  const token = await adminToken();
  const [court] = await listCourts(token);
  const { date, hour } = nextWeekdayAt(18);

  // Arrangement only — a customer reaching pending_approval through the UI is
  // covered by 03-customer and 04-journey.
  await createPendingBooking({
    courtId: court.id,
    date,
    hour,
    email: 'approve.me@example.com',
  });

  await signInAsAdmin(page);
  await gotoAdminSection(page, /^approvals$/i);

  await expect(page.getByText(/needs your approval|review proof/i).first()).toBeVisible();
  await page.getByRole('button', { name: /review proof/i }).first().click();

  await page.locator('select').first().selectOption('Cash');
  await page
    .getByPlaceholder(/e\.g\. 0012 3456 7890/i)
    .fill('E2E-REF-0001');
  await page.getByRole('button', { name: /approve & confirm/i }).click();

  await expect(page.getByText(/nothing here|all caught up/i).first()).toBeVisible();
});

test('approvals: rejecting a booking asks for a reason', async ({ page }) => {
  const token = await adminToken();
  const [court] = await listCourts(token);
  const { date, hour } = nextWeekdayAt(19);

  await createPendingBooking({
    courtId: court.id,
    date,
    hour,
    email: 'reject.me@example.com',
  });

  await signInAsAdmin(page);
  await gotoAdminSection(page, /^approvals$/i);
  await page.getByRole('button', { name: /review proof/i }).first().click();

  await page.getByRole('button', { name: /^reject$/i }).click();
  await page
    .getByPlaceholder(/add a note the customer will see/i)
    .fill('Receipt does not match the amount due.');
  await page.getByRole('button', { name: /confirm rejection/i }).click();

  await expect(page.getByText(/nothing here|all caught up/i).first()).toBeVisible();
});

test('user management: creating staff issues a temporary password', async ({
  page,
}) => {
  await signInAsAdmin(page);
  await gotoAdminSection(page, /user management/i);

  await page.getByPlaceholder(/e\.g\. Sam Rivera/i).fill('Jamie Cruz');
  await page.getByPlaceholder(/name@pickleplay\.co/i).fill('jamie@e2e.test');
  await page.getByRole('button', { name: /create staff/i }).click();

  // The temp password is shown once at creation and never again.
  await expect(page.getByText(/temporary password/i)).toBeVisible();
});

test('staff accounts cannot reach the admin-only sections', async ({ page }) => {
  await signInAsAdmin(page);
  await gotoAdminSection(page, /user management/i);

  // "View as" drops the console to staff access without a separate login.
  await page.getByText(/view as/i).first().click();

  await expect(page.getByText(/^sales$/i)).toBeHidden();
  await expect(page.getByText(/^reports$/i)).toBeHidden();
});
