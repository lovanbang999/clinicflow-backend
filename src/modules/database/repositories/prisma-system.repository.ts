import { Injectable } from '@nestjs/common';
import { Notification, SystemConfig, AuditLog, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ISystemRepository } from '../interfaces/system.repository.interface';
import { TransactionClient } from '../interfaces/clinical.repository.interface';

@Injectable()
export class PrismaSystemRepository implements ISystemRepository {
  constructor(private readonly prisma: PrismaService) {}

  countNotification(args: Prisma.NotificationCountArgs): Promise<number> {
    return this.prisma.notification.count(args);
  }
  findFirstNotification<T extends Prisma.NotificationFindFirstArgs>(
    args: Prisma.SelectSubset<T, Prisma.NotificationFindFirstArgs>,
  ): Promise<Prisma.NotificationGetPayload<T> | null> {
    return this.prisma.notification.findFirst(
      args,
    ) as Promise<Prisma.NotificationGetPayload<T> | null>;
  }
  findManyNotification<T extends Prisma.NotificationFindManyArgs>(
    args: Prisma.SelectSubset<T, Prisma.NotificationFindManyArgs>,
  ): Promise<Prisma.NotificationGetPayload<T>[]> {
    return this.prisma.notification.findMany(args) as Promise<
      Prisma.NotificationGetPayload<T>[]
    >;
  }
  findUniqueNotification<T extends Prisma.NotificationFindUniqueArgs>(
    args: Prisma.SelectSubset<T, Prisma.NotificationFindUniqueArgs>,
  ): Promise<Prisma.NotificationGetPayload<T> | null> {
    return this.prisma.notification.findUnique(
      args,
    ) as Promise<Prisma.NotificationGetPayload<T> | null>;
  }
  updateNotification(
    args: Prisma.NotificationUpdateArgs,
  ): Promise<Notification> {
    return this.prisma.notification.update(args);
  }
  updateManyNotification(
    args: Prisma.NotificationUpdateManyArgs,
  ): Promise<Prisma.BatchPayload> {
    return this.prisma.notification.updateMany(args);
  }
  createNotification(
    args: Prisma.NotificationCreateArgs,
  ): Promise<Notification> {
    return this.prisma.notification.create(args);
  }
  deleteNotification(
    args: Prisma.NotificationDeleteArgs,
  ): Promise<Notification> {
    return this.prisma.notification.delete(args);
  }
  deleteManyNotification(
    args: Prisma.NotificationDeleteManyArgs,
  ): Promise<Prisma.BatchPayload> {
    return this.prisma.notification.deleteMany(args);
  }

  countSystemConfig(args: Prisma.SystemConfigCountArgs): Promise<number> {
    return this.prisma.systemConfig.count(args);
  }
  findFirstSystemConfig<T extends Prisma.SystemConfigFindFirstArgs>(
    args: Prisma.SelectSubset<T, Prisma.SystemConfigFindFirstArgs>,
  ): Promise<Prisma.SystemConfigGetPayload<T> | null> {
    return this.prisma.systemConfig.findFirst(
      args,
    ) as Promise<Prisma.SystemConfigGetPayload<T> | null>;
  }
  findManySystemConfig<T extends Prisma.SystemConfigFindManyArgs>(
    args: Prisma.SelectSubset<T, Prisma.SystemConfigFindManyArgs>,
  ): Promise<Prisma.SystemConfigGetPayload<T>[]> {
    return this.prisma.systemConfig.findMany(args) as Promise<
      Prisma.SystemConfigGetPayload<T>[]
    >;
  }
  findUniqueSystemConfig<T extends Prisma.SystemConfigFindUniqueArgs>(
    args: Prisma.SelectSubset<T, Prisma.SystemConfigFindUniqueArgs>,
  ): Promise<Prisma.SystemConfigGetPayload<T> | null> {
    return this.prisma.systemConfig.findUnique(
      args,
    ) as Promise<Prisma.SystemConfigGetPayload<T> | null>;
  }
  updateSystemConfig(
    args: Prisma.SystemConfigUpdateArgs,
  ): Promise<SystemConfig> {
    return this.prisma.systemConfig.update(args);
  }
  createSystemConfig(
    args: Prisma.SystemConfigCreateArgs,
  ): Promise<SystemConfig> {
    return this.prisma.systemConfig.create(args);
  }
  deleteSystemConfig(
    args: Prisma.SystemConfigDeleteArgs,
  ): Promise<SystemConfig> {
    return this.prisma.systemConfig.delete(args);
  }
  upsertSystemConfig(
    args: Prisma.SystemConfigUpsertArgs,
  ): Promise<SystemConfig> {
    return this.prisma.systemConfig.upsert(args);
  }

  countAuditLog(args: Prisma.AuditLogCountArgs): Promise<number> {
    return this.prisma.auditLog.count(args);
  }
  findFirstAuditLog<T extends Prisma.AuditLogFindFirstArgs>(
    args: Prisma.SelectSubset<T, Prisma.AuditLogFindFirstArgs>,
  ): Promise<Prisma.AuditLogGetPayload<T> | null> {
    return this.prisma.auditLog.findFirst(
      args,
    ) as Promise<Prisma.AuditLogGetPayload<T> | null>;
  }
  findManyAuditLog<T extends Prisma.AuditLogFindManyArgs>(
    args: Prisma.SelectSubset<T, Prisma.AuditLogFindManyArgs>,
  ): Promise<Prisma.AuditLogGetPayload<T>[]> {
    return this.prisma.auditLog.findMany(args) as Promise<
      Prisma.AuditLogGetPayload<T>[]
    >;
  }
  findUniqueAuditLog<T extends Prisma.AuditLogFindUniqueArgs>(
    args: Prisma.SelectSubset<T, Prisma.AuditLogFindUniqueArgs>,
  ): Promise<Prisma.AuditLogGetPayload<T> | null> {
    return this.prisma.auditLog.findUnique(
      args,
    ) as Promise<Prisma.AuditLogGetPayload<T> | null>;
  }
  updateAuditLog(args: Prisma.AuditLogUpdateArgs): Promise<AuditLog> {
    return this.prisma.auditLog.update(args);
  }
  createAuditLog(args: Prisma.AuditLogCreateArgs): Promise<AuditLog> {
    return this.prisma.auditLog.create(args);
  }
  deleteAuditLog(args: Prisma.AuditLogDeleteArgs): Promise<AuditLog> {
    return this.prisma.auditLog.delete(args);
  }

  transaction<T>(fn: (tx: TransactionClient) => Promise<T>): Promise<T> {
    return this.prisma.$transaction(fn);
  }
}
