import { SetMetadata } from '@nestjs/common';

export const IS_AUTHENTICATED_KEY = 'isAuthenticatedOnly';
/**
 * Decorator to mark a route as requiring authentication but allowing ANY role.
 * Used for routes like /me or change-password.
 */
export const Authenticated = () => SetMetadata(IS_AUTHENTICATED_KEY, true);
