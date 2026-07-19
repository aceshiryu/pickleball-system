"use client";

/**
 * Google Identity Services (GIS) wrapper.
 *
 * Loads Google's script on demand and resolves to the ID token ("credential")
 * for the account the user picks. The token is opaque here — only the API
 * verifies it, so nothing in this file is trusted for identity.
 *
 * Uses the One Tap / prompt flow rather than a rendered Google button so the
 * existing "Continue with Google" styling survives.
 */

const SRC = "https://accounts.google.com/gsi/client";

export const GOOGLE_CLIENT_ID =
  process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "";

interface GoogleAccounts {
  accounts: {
    id: {
      initialize(config: {
        client_id: string;
        callback: (res: { credential?: string }) => void;
        cancel_on_tap_outside?: boolean;
        use_fedcm_for_prompt?: boolean;
      }): void;
      prompt(listener?: (n: PromptNotification) => void): void;
    };
  };
}

interface PromptNotification {
  isNotDisplayed(): boolean;
  isSkippedMoment(): boolean;
  getNotDisplayedReason?(): string;
}

let loader: Promise<void> | null = null;

/** Inject the GIS script once; subsequent calls reuse the same promise. */
function loadScript(): Promise<void> {
  if (loader) return loader;
  loader = new Promise<void>((resolve, reject) => {
    if (document.querySelector(`script[src="${SRC}"]`)) return resolve();
    const el = document.createElement("script");
    el.src = SRC;
    el.async = true;
    el.defer = true;
    el.onload = () => resolve();
    el.onerror = () =>
      reject(new Error("Could not reach Google sign-in. Check your connection."));
    document.head.appendChild(el);
  });
  return loader;
}

export class GoogleSignInError extends Error {}

/**
 * Prompt for a Google account and resolve with the ID token.
 *
 * Rejects rather than hanging when the user dismisses the chooser — the caller
 * needs to clear its busy state, and a silent no-op was the original bug in
 * this button.
 */
export async function requestGoogleIdToken(): Promise<string> {
  if (!GOOGLE_CLIENT_ID) {
    throw new GoogleSignInError(
      "Google sign-in is not configured (NEXT_PUBLIC_GOOGLE_CLIENT_ID).",
    );
  }
  await loadScript();

  const google = (window as unknown as { google?: GoogleAccounts }).google;
  if (!google?.accounts?.id) {
    throw new GoogleSignInError("Google sign-in failed to initialise.");
  }

  return new Promise<string>((resolve, reject) => {
    google.accounts.id.initialize({
      client_id: GOOGLE_CLIENT_ID,
      cancel_on_tap_outside: true,
      // FedCM lets One Tap run through the browser's own identity UI, so it no
      // longer depends on third-party cookies — which Chrome now blocks by
      // default. Without this the prompt silently fails to display.
      use_fedcm_for_prompt: true,
      callback: (res) => {
        if (res.credential) resolve(res.credential);
        else reject(new GoogleSignInError("Google sign-in was cancelled."));
      },
    });

    google.accounts.id.prompt((n) => {
      // Under FedCM the isNotDisplayed()/isSkippedMoment() inspectors are
      // removed, so feature-detect before calling them (calling a missing one
      // throws). When present (older browsers) a suppressed prompt still means
      // the chooser couldn't open — surface it instead of a stuck button.
      const suppressed =
        (typeof n.isNotDisplayed === "function" && n.isNotDisplayed()) ||
        (typeof n.isSkippedMoment === "function" && n.isSkippedMoment());
      if (suppressed) {
        reject(
          new GoogleSignInError(
            "Google sign-in didn't open. Try again — if it keeps failing, open the site in a private window, or check that pop-ups aren't blocked.",
          ),
        );
      }
    });
  });
}
