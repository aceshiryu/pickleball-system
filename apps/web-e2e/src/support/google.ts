import type { Page } from '@playwright/test';
import { stubGoogleToken } from './api';

/**
 * Stands in for Google Identity Services in the browser.
 *
 * Google actively blocks automated sign-in, so the real account chooser can't
 * be driven by Playwright. Instead the GIS script request is intercepted and
 * answered with a minimal implementation of the two functions lib/google.ts
 * actually calls — `initialize` (to capture the callback) and `prompt` (to fire
 * it with a credential).
 *
 * What stays real: the button, the store action, the POST to /auth/google, and
 * every server-side rule (signature stub aside) — role checks, account upsert,
 * JWT signing. Only the identity provider is faked, on both sides, and the API
 * refuses to boot in that mode under NODE_ENV=production.
 */

const GIS_URL = 'https://accounts.google.com/gsi/client';

export interface StubIdentity {
  email: string;
  name?: string;
}

/**
 * Install before navigating to a page with a Google button.
 *
 * Pass `cancel: true` to simulate the user dismissing the chooser, which is a
 * distinct path — lib/google.ts must reject rather than leave the button stuck
 * on "Signing in…".
 */
export async function stubGoogleSignIn(
  page: Page,
  identity: StubIdentity | { cancel: true },
): Promise<void> {
  const cancelled = 'cancel' in identity;
  const credential = cancelled
    ? ''
    : stubGoogleToken(identity.email, identity.name ?? 'E2E Player');

  await page.route(`${GIS_URL}*`, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'text/javascript',
      body: gisShim(credential, cancelled),
    }),
  );
}

function gisShim(credential: string, cancelled: boolean): string {
  // Mirrors the slice of the GIS surface lib/google.ts depends on. `prompt`
  // defers via setTimeout so the callback lands asynchronously, as the real
  // library does — a synchronous callback would hide ordering bugs.
  return `
    window.google = {
      accounts: {
        id: {
          _cb: null,
          initialize: function (config) { this._cb = config && config.callback; },
          prompt: function (listener) {
            var cb = this._cb;
            setTimeout(function () {
              if (${cancelled ? 'true' : 'false'}) {
                if (listener) listener({
                  isNotDisplayed: function () { return true; },
                  isSkippedMoment: function () { return false; },
                  getNotDisplayedReason: function () { return 'suppressed_by_user'; }
                });
                return;
              }
              if (listener) listener({
                isNotDisplayed: function () { return false; },
                isSkippedMoment: function () { return false; }
              });
              if (cb) cb({ credential: ${JSON.stringify(credential)} });
            }, 10);
          }
        }
      }
    };
  `;
}
