import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { createHash, timingSafeEqual } from 'crypto';

/**
 * Gates the guest + calendar-read endpoints (guest booking, availability,
 * courts/overrides/settings reads) behind a shared "web key" that the customer
 * and admin web apps ship. It unlocks ONLY these low-sensitivity endpoints —
 * admin/data endpoints stay on ApiAuthGuard (admin JWT / admin API key).
 *
 * This is a bar, not a secret: the key rides in the browser bundle and can be
 * extracted. What it buys is blocking casual/scripted direct access, plus the
 * ability to rotate/revoke it and rate-limit per key. Never grant this key any
 * privilege beyond these endpoints.
 *
 * Inactive until WEB_PUBLIC_API_KEY is set, so local dev and an un-provisioned
 * deploy don't break — set it in production to turn the gate on.
 */
@Injectable()
export class PublicKeyGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const configured = process.env.WEB_PUBLIC_API_KEY;
    if (!configured) return true; // gate off until configured

    const req = context.switchToHttp().getRequest();
    const provided = req.headers['x-web-key'];
    if (typeof provided === 'string' && sameSecret(provided, configured)) {
      return true;
    }
    throw new UnauthorizedException('Missing or invalid web key');
  }
}

// Constant-time compare via fixed-length SHA-256 digests (timingSafeEqual
// throws on length mismatch, and hashing avoids leaking the length).
function sameSecret(a: string, b: string): boolean {
  const ha = createHash('sha256').update(a).digest();
  const hb = createHash('sha256').update(b).digest();
  return timingSafeEqual(ha, hb);
}
