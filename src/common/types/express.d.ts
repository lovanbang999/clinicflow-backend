import { UserRole } from '@prisma/client';

export {};

declare global {
  namespace Express {
    interface User {
      id: string;
      email: string;
      role: UserRole;
      fullName?: string;
    }

    interface Request {
      user?: User;
    }
  }
}

export type RequestWithUser = Request & { user?: AuthUser };

export type AuthUser = {
  id: string;
  email: string;
  role: UserRole;
  fullName?: string;
};
