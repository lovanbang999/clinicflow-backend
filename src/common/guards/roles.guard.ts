import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '@prisma/client';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { IS_AUTHENTICATED_KEY } from '../decorators/authenticated.decorator';
import { RequestWithUser } from '../types/express';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // 1. Check if route is marked as public
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    // 2. Check for required roles
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    // 3. Check if only authentication is required (any role)
    const isAuthenticatedOnly = this.reflector.getAllAndOverride<boolean>(
      IS_AUTHENTICATED_KEY,
      [context.getHandler(), context.getClass()],
    );

    const { user } = context.switchToHttp().getRequest<RequestWithUser>();

    // No user means JwtAuthGuard didn't run or failed (shouldn't happen if properly applied)
    if (!user) return false;

    // If roles are specified, check if user has one
    if (requiredRoles) {
      return requiredRoles.some((role) => user.role === role);
    }

    // If marked as authenticated only (but no specific role), allow
    if (isAuthenticatedOnly) return true;

    // FALLBACK: If a guard is applied but no role/auth marker is present -> DENY BY DEFAULT
    // This forces explicitly marking routes with @Roles() or @Authenticated() or @Public()
    return false;
  }
}
