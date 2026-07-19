"use client";

/**
 * Google Identity Services (GIS) wrapper.
 *
 * Loads Google's script on demand and renders Google's own Sign-In button,
 * whose callback hands back the ID token ("credential") for the account the
 * user picks. The token is opaque here — only the API verifies it, so nothing
 * in this file is trusted for identity.
 *
 * Deliberately uses the RENDERED BUTTON, not One Tap `prompt()`. One Tap
 * self-suppresses (exponential-backoff cooldown after use, and it needs
 * third-party cookies), which made the button "work once then stop". The
 * rendered button opens a popup on every click — no cooldown, no third-party
 * cookie dependency — at the cost of Google's own button styling.
 */

const SRC = "https://accounts.google.com/gsi/client";

export const GOOGLE_CLIENT_ID =
  process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "";

interface GsiButtonConfig {
  type?: "standard" | "icon";
  theme?: "outline" | "filled_blue" | "filled_black";
  size?: "large" | "medium" | "small";
  text?: "signin_with" | "signup_with" | "continue_with" | "signin";
  shape?: "rectangular" | "pill" | "circle" | "square";
  logo_alignment?: "left" | "center";
  width?: number;
}

interface GoogleAccounts {
  accounts: {
    id: {
      initialize(config: {
        client_id: string;
        callback: (res: { credential?: string }) => void;
        cancel_on_tap_outside?: boolean;
        use_fedcm_for_prompt?: boolean;
      }): void;
      renderButton(parent: HTMLElement, config: GsiButtonConfig): void;
    };
  };
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

export interface RenderGoogleButtonOptions {
  /** Called with the ID token once the user picks an account. */
  onToken: (idToken: string) => void;
  /** Called if the button can't be set up (unconfigured, script blocked). */
  onError: (err: GoogleSignInError) => void;
  /** Button width in px (Google caps at 400). Defaults to 320. */
  width?: number;
}

/**
 * Render Google's Sign-In button into `container`. Its callback fires on every
 * click with a fresh ID token — no One Tap cooldown, no third-party cookies.
 *
 * Setup failures (missing client id, blocked script) go to `onError` so the
 * caller can show a message instead of an empty box. Account-chooser dismissal
 * simply fires nothing — the user can click again — so there's no "cancelled"
 * error to surface here.
 */
export async function renderGoogleButton(
  container: HTMLElement,
  opts: RenderGoogleButtonOptions,
): Promise<void> {
  if (!GOOGLE_CLIENT_ID) {
    opts.onError(
      new GoogleSignInError(
        "Google sign-in is not configured (NEXT_PUBLIC_GOOGLE_CLIENT_ID).",
      ),
    );
    return;
  }
  try {
    await loadScript();
  } catch (e) {
    opts.onError(
      new GoogleSignInError(
        e instanceof Error ? e.message : "Could not reach Google sign-in.",
      ),
    );
    return;
  }

  const google = (window as unknown as { google?: GoogleAccounts }).google;
  if (!google?.accounts?.id) {
    opts.onError(new GoogleSignInError("Google sign-in failed to initialise."));
    return;
  }

  google.accounts.id.initialize({
    client_id: GOOGLE_CLIENT_ID,
    callback: (res) => {
      if (res.credential) opts.onToken(res.credential);
    },
  });
  google.accounts.id.renderButton(container, {
    type: "standard",
    theme: "outline",
    size: "large",
    text: "continue_with",
    shape: "pill",
    logo_alignment: "center",
    width: Math.min(opts.width ?? 320, 400),
  });
}
