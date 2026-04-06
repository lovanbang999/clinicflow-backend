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
}
