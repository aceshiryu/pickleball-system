import type { FullConfig } from '@playwright/test';
import { API, ADMIN_EMAIL, adminToken, listCourts } from './api';

/**
 * Waits for the API and asserts the database is in the shape the suite expects:
 * the seeded admin, and no facility data at all.
 *
 * Deliberately seeds nothing. The specs provision what they need, because
 * "a fresh deploy has exactly one account and no sample data" is itself one of
 * the things under test — 01-onboarding drives the wizard from that state.
 */

async function waitForApi(retries = 90): Promise<void> {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(`${API}/settings`);
      if (res.ok) return;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error(`[web-e2e] API not reachable at ${API} after ${retries}s`);
}

export default async function globalSetup(_config: FullConfig) {
  console.log('\n[web-e2e] waiting for API…');
  await waitForApi();

  let token: string;
  try {
    token = await adminToken();
  } catch (e) {
    // Overwhelmingly the cause is a SEED_ADMIN_PASSWORD mismatch between the
    // seed that ran in the webServer command and support/api.ts.
    throw new Error(
      `[web-e2e] could not sign in as ${ADMIN_EMAIL}. The seeded password and ` +
        `the one support/api.ts uses must match — set SEED_ADMIN_PASSWORD for ` +
        `both, or leave it unset so both fall back to the same default.\n` +
        `  underlying: ${(e as Error).message}`,
    );
  }

  const courts = await listCourts(token);
  if (courts.length > 0) {
    throw new Error(
      `[web-e2e] expected an empty facility but found ${courts.length} court(s). ` +
        `reset-db.mjs should have truncated before the seed — check the webServer command.`,
    );
  }

  console.log('[web-e2e] ready: admin account only, no facility data.\n');
}
