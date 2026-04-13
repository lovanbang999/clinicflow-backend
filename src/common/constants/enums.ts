/**
 * Local enum definitions that mirror Prisma enums.
 * Used as a fallback when Prisma client has not been regenerated yet,
 * or when the enum is not yet present in @prisma/client.
 */

export const ServiceOrderStatus = {
  PENDING: 'PENDING',
  PAID: 'PAID',
  IN_PROGRESS: 'IN_PROGRESS',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
} as const;

export type ServiceOrderStatus =
  (typeof ServiceOrderStatus)[keyof typeof ServiceOrderStatus];
