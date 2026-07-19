import { SetMetadata } from '@nestjs/common';
import type { UserRole } from '../../users/user.entity';

export const ROLES_KEY = 'roles';

// Restrict a route to one or more roles. Use with RolesGuard (after JwtAuthGuard).
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
