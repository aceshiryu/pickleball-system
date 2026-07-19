import { test, expect } from '@playwright/test';
import { signInAsAdmin } from './support/ui';
import { adminToken, getSettings, listCourts } from './support/api';

/**
 * Scenario 9 — first run on a fresh deploy.
 *
 * Runs first (filename order, single worker) because it is the only spec that
 * requires an un-onboarded facility, and it leaves the facility provisioned for
 * everything after it. If you run a later spec in isolation it will provision
 * via the API instead; this one proves the same thing happens through the UI.
 */

test.describe.configure({ mode: 'serial' });

test('a fresh deploy has the admin account and nothing else', async () => {
  const token = await adminToken();
  const courts = await listCourts(token);
  const settings = await getSettings(token);

  expect(courts).toHaveLength(0);
  expect(settings.onboardingCompletedAt).toBeNull();
});

test('the console blocks an un-onboarded facility', async ({ page }) => {
  await signInAsAdmin(page);
  await expect(
    page.getByText(/finish setting up your facility/i),
  ).toBeVisible();
});

test('admin completes onboarding through the wizard', async ({ page }) => {
  await signInAsAdmin(page);
  await expect(page.getByText(/finish setting up your facility/i)).toBeVisible();

  // --- Step 1: branding ---
  await page.getByRole('textbox').first().fill('E2E Pickleball Club');
  await page.getByRole('button', { name: /^next$/i }).click();

  // --- Step 2: hours + at least one court ---
  await expect(page.getByText(/add a court/i)).toBeVisible();
  await page.getByPlaceholder('Center Court').fill('Center Court');
  await page.getByRole('button', { name: /^add court$/i }).click();
  await expect(page.getByText(/^added$/i).first()).toBeVisible();
  await page.getByRole('button', { name: /^next$/i }).click();

  // --- Step 3: peak hours (defaults are valid, just advance) ---
  await expect(page.getByText(/court hours/i).first()).toBeVisible();
  await page.getByRole('button', { name: /^next$/i }).click();

  // --- Step 4: payments ---
  await expect(page.getByText(/payment method/i).first()).toBeVisible();
  await page.getByRole('button', { name: /^\+ GCash$/ }).click();
  await expect(page.getByText(/^added$/i).first()).toBeVisible();
  await page.getByRole('button', { name: /^next$/i }).click();

  // --- Step 5: staff is optional ---
  await page.getByRole('button', { name: /^next$/i }).click();

  // --- Review + finish ---
  await expect(page.getByText(/all required steps done/i)).toBeVisible();
  await page.getByRole('button', { name: /^finish setup$/i }).click();

  // The blocking modal is gone and the console is usable.
  await expect(
    page.getByText(/finish setting up your facility/i),
  ).toBeHidden();
  await expect(page.getByRole('heading', { name: /dashboard/i })).toBeVisible();
});

test('onboarding is recorded server-side, not just in the UI', async () => {
  // The guard is what actually protects the API, so assert the flag rather
  // than trusting that the modal closed.
  const token = await adminToken();
  const settings = await getSettings(token);
  expect(settings.onboardingCompletedAt).not.toBeNull();
  expect(settings.paymentMethods).toContain('GCash');
});
