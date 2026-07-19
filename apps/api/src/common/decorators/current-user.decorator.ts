import { createParamDecorator, ExecutionContext } from '@nestjs/common';

import type { UserRole } from '../../users/user.entity';

export interface CurrentUserPayload {
  sub: string;
  email: string;
  role: UserRole;
}

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): CurrentUserPayload => {
    const request = ctx.switchToHttp().getRequest();
    return request.user;
  },
);
