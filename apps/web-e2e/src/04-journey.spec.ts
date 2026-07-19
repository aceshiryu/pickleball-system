import { test, expect } from '@playwright/test';
import {
  attachReceipt,
  gotoAdminSection,
  selectSlot,
  signInAsAdmin,
  signInAsCustomer,
} from './support/ui';
import { nextWeekdayAt, provisionFacility } from './support/api';

/**
 * Scenario 19 — the one test that proves the product works.
 *
 * Customer books and pays in one browser context, admin approves in another,
 * then the customer sees the confirmation. Everything goes through the UI; no
 * API shortcuts. If only one e2e test could survive, it should be this one.
 */

test.describe.configure({ mode: 'serial' });

test.beforeAll(async () => {
  await provisionFacility();
});

test('customer books → admin approves → customer sees it confirmed', async ({
  browser,
}) => {
  const { date, hour } = nextWeekdayAt(17);
  const customerEmail = 'journey@example.com';

  // --- 1. Customer books and submits payment ---
  const customerContext = await browser.newContext();
  const customer = await customerContext.newPage();

  await signInAsCustomer(customer, {
    email: customerEmail,
    name: 'Journey Player',
    phone: '0917 000 1111',
  });
  await selectSlot(customer, date, hour);
  await customer.getByRole('button', { name: /continue to payment/i }).click();
  await expect(customer.getByText(/your slots are held for/i)).toBeVisible();

  await attachReceipt(customer);
  await customer.getByRole('button', { name: /submit|pay/i }).first().click();
  await expect(customer.getByText(/payment submitted/i)).toBeVisible();

  // --- 2. Admin approves it in a separate session ---
  const adminContext = await browser.newContext();
  const admin = await adminContext.newPage();

  await signInAsAdmin(admin);
  await gotoAdminSection(admin, /^approvals$/i);
  await admin.getByRole('button', { name: /review proof/i }).first().click();

  await admin.locator('select').first().selectOption('GCash');
  await admin
    .getByPlaceholder(/e\.g\. 0012 3456 7890/i)
    .fill('JOURNEY-REF-001');
  await admin.getByRole('button', { name: /approve & confirm/i }).click();
  await expect(
    admin.getByText(/nothing here|all caught up/i).first(),
  ).toBeVisible();

  // --- 3. The customer sees the confirmation ---
  await customer.reload();
  await customer.getByText(/my bookings/i).first().click();
  await expect(customer.getByText(/confirmed/i).first()).toBeVisible();

  await customerContext.close();
  await adminContext.close();
});
