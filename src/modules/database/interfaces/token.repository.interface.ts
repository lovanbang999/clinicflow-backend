import { RefreshToken, User } from '@prisma/client';

export const I_TOKEN_REPOSITORY = 'ITokenRepository';

export interface ITokenRepository {
  create(data: {
    userId: string;
    token: string;
    expiresAt: Date;
  }): Promise<RefreshToken>;
  findByTokenWithUser(
    token: string,
  ): Promise<(RefreshToken & { user: User }) | null>;
  revokeToken(token: string): Promise<void>;
}
