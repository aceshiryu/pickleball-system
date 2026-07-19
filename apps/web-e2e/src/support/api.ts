/**
 * Direct API helpers for the browser suite.
 *
 * Used for arrangement, never for the behaviour under test: setting up a court
 * so a booking spec has something to click is plumbing, but the booking itself
 * must go through the UI. Anywhere a spec uses these to reach a state the user
 * would normally reach by clicking, that's called out in the spec.
 *
 * The e2e database is seeded with the admin account and nothing else — same as
 * a fresh production deploy — so every fixture below is created per run.
 */

export const API =
  process.env.E2E_API_BASE_URL ?? 'http://localhost:3011/api';

export const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL ?? 'admin@pickleplay.co';
export const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD ?? 'P@ssw0rd123';

type Json = Record<string, unknown>;

async function req<T>(
  method: string,
  path: string,
  opts: { token?: string; body?: Json } = {},
): Promise<T> {
  const headers: Record<string, string> = {};
  if (opts.token) headers.Authorization = `Bearer ${opts.token}`;
  if (opts.body) headers['Content-Type'] = 'application/json';

  const res = await fetch(`${API}${path}`, {
    method,
    headers,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) {
    // Surface the API's own message — a bare "500" in a setup helper is the
    // most annoying possible way to fail a browser suite.
    throw new Error(`${method} ${path} → ${res.status}: ${text.slice(0, 400)}`);
  }
  return (text ? JSON.parse(text) : undefined) as T;
}

export async function adminToken(): Promise<string> {
  const r = await req<{ accessToken: string }>('POST', '/auth/login', {
    body: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
  });
  return r.accessToken;
}

/** Sign a customer in through the stubbed Google verifier. */
export async function customerToken(
  email: string,
  name = 'E2E Player',
): Promise<{ token: string; needsProfile: boolean }> {
  const r = await req<{ accessToken: string; needsProfile: boolean }>(
    'POST',
    '/auth/google',
    { body: { idToken: stubGoogleToken(email, name) } },
  );
  return { token: r.accessToken, needsProfile: r.needsProfile };
}

/** The fake credential shape GoogleVerifier accepts when GOOGLE_AUTH_STUB=1. */
export function stubGoogleToken(email: string, name = 'E2E Player'): string {
  return ['stub', `google-${email}`, email, name].join(':');
}

export interface CourtInput {
  name: string;
  surface?: string;
  peakRate?: number;
  offPeakRate?: number;
}

export async function createCourt(
  token: string,
  input: CourtInput,
): Promise<{ id: string; name: string }> {
  return req('POST', '/courts', {
    token,
    body: {
      name: input.name,
      surface: input.surface ?? 'Cushioned acrylic',
      peakRate: input.peakRate ?? 700,
      offPeakRate: input.offPeakRate ?? 450,
    },
  });
}

export async function listCourts(
  token: string,
): Promise<{ id: string; name: string }[]> {
  return req('GET', '/courts', { token });
}

// Payment methods are structured objects now. This helper takes a light shape
// and fills the required per-type fields so arrangement stays terse.
export interface E2EPaymentMethod {
  id: string;
  type: 'gcash' | 'maya' | 'bank' | 'cash' | 'other';
  label: string;
  phone?: string;
  bankName?: string;
  accountNumber?: string;
  accountName?: string;
  qr?: string | null;
}

export async function setPaymentMethods(
  token: string,
  methods: E2EPaymentMethod[],
): Promise<void> {
  await req('PATCH', '/settings', { token, body: { paymentMethods: methods } });
}

export async function getSettings(token?: string): Promise<{
  paymentMethods: E2EPaymentMethod[];
  onboardingCompletedAt: string | null;
  appName: string;
}> {
  return req('GET', '/settings', { token });
}

export async function completeOnboarding(token: string): Promise<void> {
  await req('POST', '/settings/complete-onboarding', { token });
}

/**
 * Bring a brand-new facility to "open for business": one court, payment
 * methods, onboarding finished. Mirrors what the onboarding wizard does, so
 * specs that aren't testing onboarding don't have to click through it.
 */
export async function provisionFacility(opts: { courtName?: string } = {}) {
  const token = await adminToken();
  const settings = await getSettings(token);

  const courts = await listCourts(token);
  const courtName = opts.courtName ?? 'Center Court';
  const court =
    courts.find((c) => c.name === courtName) ??
    (await createCourt(token, { name: courtName }));

  await setPaymentMethods(token, [
    { id: 'm_cash', type: 'cash', label: 'Cash' },
    { id: 'm_gcash', type: 'gcash', label: 'GCash', phone: '0917 555 1234' },
  ]);
  if (!settings.onboardingCompletedAt) await completeOnboarding(token);

  return { token, court };
}

/** A booking parked in `pending_approval`, ready for an approvals spec. */
export async function createPendingBooking(opts: {
  courtId: string;
  date: string;
  hour: number;
  email: string;
}): Promise<{ id: string; ref: string }> {
  const { token } = await customerToken(opts.email);
  await req('POST', '/auth/complete-profile', {
    token,
    body: { name: 'E2E Player', phone: '0917 123 4567' },
  });
  const held = await req<{ id: string; ref: string }[]>('POST', '/bookings/hold', {
    token,
    body: { items: [{ courtId: opts.courtId, date: opts.date, hour: opts.hour }] },
  });
  await req('POST', '/bookings/submit-payment', {
    token,
    body: { ids: held.map((b) => b.id), proofFileName: 'receipt.png' },
  });
  return held[0];
}

/** yyyy-mm-dd, local parts — never toISOString (see CLAUDE.md on dates). */
export function dateInDays(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Next weekday at a peak hour, so pricing assertions are deterministic. */
export function nextWeekdayAt(hour: number): { date: string; hour: number } {
  for (let i = 1; i <= 10; i++) {
    const date = dateInDays(i);
    const dow = new Date(`${date}T12:00:00`).getDay();
    if (dow !== 0 && dow !== 6) return { date, hour };
  }
  throw new Error('no weekday found in the next 10 days');
}
