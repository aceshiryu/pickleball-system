import {
  Injectable,
  Logger,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { OAuth2Client } from 'google-auth-library';

/** The subset of Google's ID-token claims this app trusts. */
export interface GoogleIdentity {
  /** Google's stable per-account subject id. Never reused, never changes. */
  sub: string;
  email: string;
  name: string;
}

/**
 * Verifies Google ID tokens (the `credential` returned by Google Identity
 * Services in the browser).
 *
 * Unlike StorageService, this does NOT degrade to a permissive fallback when
 * unconfigured — an auth check that passes when misconfigured is worse than one
 * that fails. Missing GOOGLE_CLIENT_ID means every sign-in is refused with 503.
 *
 * Injected rather than called statically so the e2e harness can substitute a
 * stub identity without reaching Google over the network.
 */
/**
 * Test-only mode. Real Google ID tokens can't be minted by a browser test —
 * Google blocks automated sign-in — so the e2e suite runs the API with
 * GOOGLE_AUTH_STUB=1 and posts `stub:<sub>:<email>:<name>` instead.
 *
 * This is an authentication bypass, so it is guarded structurally rather than
 * by convention: the constructor throws when NODE_ENV=production, which fails
 * the container at boot instead of quietly accepting forged identities. Every
 * other layer (role rules, upsert, JWT signing) still runs for real.
 */
const STUB_MODE = process.env.GOOGLE_AUTH_STUB === '1';
const STUB_PREFIX = 'stub:';

@Injectable()
export class GoogleVerifier {
  private readonly log = new Logger(GoogleVerifier.name);
  private readonly clientId = process.env.GOOGLE_CLIENT_ID;
  private readonly client: OAuth2Client | null;

  constructor() {
    if (STUB_MODE) {
      if (process.env.NODE_ENV === 'production') {
        throw new Error(
          'GOOGLE_AUTH_STUB is set while NODE_ENV=production. This would accept ' +
            'forged Google identities. Refusing to start.',
        );
      }
      this.client = null;
      this.log.warn(
        'GOOGLE_AUTH_STUB=1 — Google ID tokens are NOT verified. Test builds only.',
      );
      return;
    }
    if (!this.clientId) {
      this.client = null;
      this.log.warn(
        'GOOGLE_CLIENT_ID is not set — customer Google sign-in will be refused.',
      );
      return;
    }
    this.client = new OAuth2Client(this.clientId);
  }

  async verify(idToken: string): Promise<GoogleIdentity> {
    if (STUB_MODE) return this.verifyStub(idToken);

    if (!this.client || !this.clientId) {
      throw new ServiceUnavailableException(
        'Google sign-in is not configured on this server.',
      );
    }

    let payload;
    try {
      // Checks the signature against Google's rotating public keys, plus `aud`
      // (our client id), `iss`, and expiry. A token minted for a different app
      // fails here — which is the whole point of passing `audience`.
      const ticket = await this.client.verifyIdToken({
        idToken,
        audience: this.clientId,
      });
      payload = ticket.getPayload();
    } catch (err) {
      this.log.warn(`Rejected Google ID token: ${(err as Error).message}`);
      throw new UnauthorizedException('Invalid Google sign-in.');
    }

    if (!payload?.email) {
      throw new UnauthorizedException('Google account has no email address.');
    }
    // An unverified address could be anyone's. Matching accounts on it would
    // let someone claim an existing user's email by asserting it at Google.
    if (!payload.email_verified) {
      throw new UnauthorizedException(
        'Your Google email address is not verified.',
      );
    }

    return {
      sub: payload.sub,
      email: payload.email.toLowerCase(),
      name: payload.name ?? payload.email.split('@')[0],
    };
  }

  /** Decode `stub:<sub>:<email>:<name>`. Test builds only — see STUB_MODE. */
  private verifyStub(idToken: string): GoogleIdentity {
    if (!idToken.startsWith(STUB_PREFIX)) {
      throw new UnauthorizedException('Invalid Google sign-in.');
    }
    const [, sub, email, name] = idToken.split(':');
    if (!sub || !email) {
      throw new UnauthorizedException('Invalid Google sign-in.');
    }
    return { sub, email: email.toLowerCase(), name: name || email.split('@')[0] };
  }
}
