import { VerificationCode, VerificationType } from '@prisma/client';

export const I_VERIFICATION_REPOSITORY = 'IVerificationRepository';

export interface IVerificationRepository {
  create(data: {
    userId: string;
    code: string;
    type: VerificationType;
    expiresAt: Date;
  }): Promise<VerificationCode>;
  findLatestValidCode(
    userId: string,
    code: string,
    type: VerificationType,
  ): Promise<VerificationCode | null>;

  findLatestCode(
    userId: string,
    type: VerificationType,
  ): Promise<VerificationCode | null>;

  updateAttempts(id: string, attempts: number): Promise<void>;

  invalidateCode(id: string): Promise<void>;

  countCodesSince(
    userId: string,
    type: VerificationType,
    since: Date,
  ): Promise<number>;
}
