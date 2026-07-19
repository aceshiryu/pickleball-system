import { ApiError } from './api-client';
import { GoogleSignInError } from './google';

// Raw failures are developer-facing and sometimes meaningless to a person:
//   401 -> "Invalid credentials"
//   400 -> "email must be an email, password must be longer than or equal to 6 characters"
//   429 -> "ThrottlerException: Too Many Requests"
//   API down -> fetch() rejects with a TypeError, "Failed to fetch"
// Map them to something the reader can actually act on.

export function friendlySignInError(e: unknown): string {
  if (e instanceof ApiError) {
    switch (e.status) {
      case 400:
        return 'Enter a valid email address and your password.';
      case 401:
        // Deliberately vague about which half was wrong, so the form can't be
        // used to discover which emails have accounts.
        return 'Incorrect email or password. Please try again.';
      case 403:
        return "This account doesn't have access to the admin console.";
      case 429:
        return 'Too many sign-in attempts. Please wait a minute and try again.';
      default:
        return e.status >= 500
          ? 'Something went wrong on our end. Please try again in a moment.'
          : 'Sign in failed. Please try again.';
    }
  }
  // fetch() rejects with a TypeError when the API is unreachable.
  return 'Cannot reach the server. Check your connection and try again.';
}

/**
 * Google sign-in fails differently from the password form: the failure is often
 * in the browser (cancelled chooser, blocked cookies, missing client id) and
 * never involves a password, so "Incorrect email or password" would be a lie.
 */
export function friendlyGoogleSignInError(e: unknown): string {
  // Already written for a person by lib/google.ts.
  if (e instanceof GoogleSignInError) return e.message;

  if (e instanceof ApiError) {
    switch (e.status) {
      case 401:
        // The server distinguishes a bad token from an admin/staff address
        // trying the customer door; both messages are safe to show as-is.
        return e.message || 'Google sign-in failed. Please try again.';
      case 429:
        return 'Too many sign-in attempts. Please wait a minute and try again.';
      case 503:
        return 'Google sign-in is not available right now. Please try again later.';
      default:
        return e.status >= 500
          ? 'Something went wrong on our end. Please try again in a moment.'
          : 'Sign in failed. Please try again.';
    }
  }
  return 'Cannot reach the server. Check your connection and try again.';
}
