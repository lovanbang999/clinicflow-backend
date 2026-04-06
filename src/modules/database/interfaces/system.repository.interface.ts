import { Notification, SystemConfig, AuditLog, Prisma } from '@prisma/client';
import { TransactionClient } from './clinical.repository.interface';

export const I_SYSTEM_REPOSITORY = 'ISystemRepository';

export interface ISystemRepository {
  countNotification(args: Prisma.NotificationCountArgs): Promise<number>;
  findFirstNotification<T extends Prisma.NotificationFindFirstArgs>(
    args: Prisma.SelectSubset<T, Prisma.NotificationFindFirstArgs>,
  ): Promise<Prisma.NotificationGetPayload<T> | null>;
  findManyNotification<T extends Prisma.NotificationFindManyArgs>(
    args: Prisma.SelectSubset<T, Prisma.NotificationFindManyArgs>,
  ): Promise<Prisma.NotificationGetPayload<T>[]>;
  findUniqueNotification<T extends Prisma.NotificationFindUniqueArgs>(
    args: Prisma.SelectSubset<T, Prisma.NotificationFindUniqueArgs>,
  ): Promise<Prisma.NotificationGetPayload<T> | null>;
  updateNotification(
    args: Prisma.NotificationUpdateArgs,
  ): Promise<Notification>;
  updateManyNotification(
    args: Prisma.NotificationUpdateManyArgs,
  ): Promise<Prisma.BatchPayload>;
  createNotification(
    args: Prisma.NotificationCreateArgs,
  ): Promise<Notification>;
  deleteNotification(
    args: Prisma.NotificationDeleteArgs,
  ): Promise<Notification>;
  deleteManyNotification(
    args: Prisma.NotificationDeleteManyArgs,
  ): Promise<Prisma.BatchPayload>;

  countSystemConfig(args: Prisma.SystemConfigCountArgs): Promise<number>;
  findFirstSystemConfig<T extends Prisma.SystemConfigFindFirstArgs>(
    args: Prisma.SelectSubset<T, Prisma.SystemConfigFindFirstArgs>,
  ): Promise<Prisma.SystemConfigGetPayload<T> | null>;
  findManySystemConfig<T extends Prisma.SystemConfigFindManyArgs>(
    args: Prisma.SelectSubset<T, Prisma.SystemConfigFindManyArgs>,
  ): Promise<Prisma.SystemConfigGetPayload<T>[]>;
  findUniqueSystemConfig<T extends Prisma.SystemConfigFindUniqueArgs>(
    args: Prisma.SelectSubset<T, Prisma.SystemConfigFindUniqueArgs>,
  ): Promise<Prisma.SystemConfigGetPayload<T> | null>;
  updateSystemConfig(
    args: Prisma.SystemConfigUpdateArgs,
  ): Promise<SystemConfig>;
  createSystemConfig(
    args: Prisma.SystemConfigCreateArgs,
  ): Promise<SystemConfig>;
  deleteSystemConfig(
    args: Prisma.SystemConfigDeleteArgs,
  ): Promise<SystemConfig>;
  upsertSystemConfig(
    args: Prisma.SystemConfigUpsertArgs,
  ): Promise<SystemConfig>;

  countAuditLog(args: Prisma.AuditLogCountArgs): Promise<number>;
  findFirstAuditLog<T extends Prisma.AuditLogFindFirstArgs>(
    args: Prisma.SelectSubset<T, Prisma.AuditLogFindFirstArgs>,
  ): Promise<Prisma.AuditLogGetPayload<T> | null>;
  findManyAuditLog<T extends Prisma.AuditLogFindManyArgs>(
    args: Prisma.SelectSubset<T, Prisma.AuditLogFindManyArgs>,
  ): Promise<Prisma.AuditLogGetPayload<T>[]>;
  findUniqueAuditLog<T extends Prisma.AuditLogFindUniqueArgs>(
    args: Prisma.SelectSubset<T, Prisma.AuditLogFindUniqueArgs>,
  ): Promise<Prisma.AuditLogGetPayload<T> | null>;
  updateAuditLog(args: Prisma.AuditLogUpdateArgs): Promise<AuditLog>;
  createAuditLog(args: Prisma.AuditLogCreateArgs): Promise<AuditLog>;
  deleteAuditLog(args: Prisma.AuditLogDeleteArgs): Promise<AuditLog>;

  transaction<T>(fn: (tx: TransactionClient) => Promise<T>): Promise<T>;
}
