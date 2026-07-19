import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import {
  API_KEY_PREFIX,
  ApiKeysService,
} from '../../api-keys/api-keys.service';

/**
 * Accepts EITHER a session JWT (from the web app) OR a long-lived API key
 * (prefix `pickleball-`) in `Authorization: Bearer …`, so machine callers and
 * browser users hit the same endpoints under the same role rules.
 *
 * Populates request.user identically in both cases — including `role`, which
 * RolesGuard reads. A key is exactly as privileged as the account that owns it.
 */
@Injectable()
export class ApiAuthGuard implements CanActivate {
  constructor(private readonly apiKeys: ApiKeysService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const header: string | undefined = req.headers['authorization'];
    const token = header?.startsWith('Bearer ') ? header.slice(7) : undefined;

    if (token?.startsWith(API_KEY_PREFIX)) {
      const user = await this.apiKeys.validate(token);
      if (!user) throw new UnauthorizedException('Invalid API key');
      req.user = user;
      return true;
    }

    // Anything else is treated as a JWT (passport 'jwt' strategy).
    return (await new JwtAuthGuard().canActivate(context)) as boolean;
  }
}
