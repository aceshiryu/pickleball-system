import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Request } from 'express';
import { SettingsService } from '../../settings/settings.service';

// Until the admin finishes onboarding the facility isn't usable, so every
// mutating request is refused — the console's blocking modal is the UX, this is
// the actual enforcement (a client can't just skip it with devtools).
//
// Reads are always allowed: the console has to load its own data to render the
// onboarding flow at all.
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

// Writes that must stay open, because they're how onboarding gets done.
// Matched against the path with the global 'api' prefix stripped.
const ALLOWED_WRITE_PREFIXES = [
  '/auth', // sign in / profile
  '/settings', // branding, hours, peak hours + complete-onboarding
  '/courts', // step 2: add courts & pricing
  '/staff', // step 4: staff accounts
];

@Injectable()
export class OnboardingGuard implements CanActivate {
  constructor(private readonly settingsService: SettingsService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request>();
    if (SAFE_METHODS.has(req.method)) return true;

    const path = (req.path || req.url || '').replace(/^\/api/, '');
    if (ALLOWED_WRITE_PREFIXES.some((p) => path.startsWith(p))) return true;

    if (await this.settingsService.isOnboardingComplete()) return true;

    throw new ForbiddenException(
      'This facility is still being set up. An admin needs to finish onboarding before bookings can be taken.',
    );
  }
}
