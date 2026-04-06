import { Injectable } from '@nestjs/common';
import {
  MedicalRecord,
  LabOrder,
  VisitServiceOrder,
  Prescription,
  Icd10Code,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  IClinicalRepository,
  TransactionClient,
} from '../interfaces/clinical.repository.interface';

@Injectable()
export class PrismaClinicalRepository implements IClinicalRepository {
  constructor(private readonly prisma: PrismaService) {}

  // Medical Record delegates
  countMedicalRecord(args: Prisma.MedicalRecordCountArgs): Promise<number> {
    return this.prisma.medicalRecord.count(args);
  }
  findFirstMedicalRecord<T extends Prisma.MedicalRecordFindFirstArgs>(
    args: Prisma.SelectSubset<T, Prisma.MedicalRecordFindFirstArgs>,
  ): Promise<Prisma.MedicalRecordGetPayload<T> | null> {
    return this.prisma.medicalRecord.findFirst(
      args,
    ) as Promise<Prisma.MedicalRecordGetPayload<T> | null>;
  }
  findManyMedicalRecord<T extends Prisma.MedicalRecordFindManyArgs>(
    args: Prisma.SelectSubset<T, Prisma.MedicalRecordFindManyArgs>,
  ): Promise<Prisma.MedicalRecordGetPayload<T>[]> {
    return this.prisma.medicalRecord.findMany(args) as Promise<
      Prisma.MedicalRecordGetPayload<T>[]
    >;
  }
  findUniqueMedicalRecord<T extends Prisma.MedicalRecordFindUniqueArgs>(
    args: Prisma.SelectSubset<T, Prisma.MedicalRecordFindUniqueArgs>,
  ): Promise<Prisma.MedicalRecordGetPayload<T> | null> {
    return this.prisma.medicalRecord.findUnique(
      args,
    ) as Promise<Prisma.MedicalRecordGetPayload<T> | null>;
  }
  updateMedicalRecord<T extends Prisma.MedicalRecordUpdateArgs>(
    args: Prisma.SelectSubset<T, Prisma.MedicalRecordUpdateArgs>,
  ): Promise<Prisma.MedicalRecordGetPayload<T>> {
    return this.prisma.medicalRecord.update(args) as Promise<
      Prisma.MedicalRecordGetPayload<T>
    >;
  }
  createMedicalRecord(
    args: Prisma.MedicalRecordCreateArgs,
  ): Promise<MedicalRecord> {
    return this.prisma.medicalRecord.create(args);
  }

  // Lab Order
  countLabOrder(args: Prisma.LabOrderCountArgs): Promise<number> {
    return this.prisma.labOrder.count(args);
  }
  findFirstLabOrder<T extends Prisma.LabOrderFindFirstArgs>(
    args: Prisma.SelectSubset<T, Prisma.LabOrderFindFirstArgs>,
  ): Promise<Prisma.LabOrderGetPayload<T> | null> {
    return this.prisma.labOrder.findFirst(
      args,
    ) as Promise<Prisma.LabOrderGetPayload<T> | null>;
  }
  findManyLabOrder<T extends Prisma.LabOrderFindManyArgs>(
    args: Prisma.SelectSubset<T, Prisma.LabOrderFindManyArgs>,
  ): Promise<Prisma.LabOrderGetPayload<T>[]> {
    return this.prisma.labOrder.findMany(args) as Promise<
      Prisma.LabOrderGetPayload<T>[]
    >;
  }
  findUniqueLabOrder<T extends Prisma.LabOrderFindUniqueArgs>(
    args: Prisma.SelectSubset<T, Prisma.LabOrderFindUniqueArgs>,
  ): Promise<Prisma.LabOrderGetPayload<T> | null> {
    return this.prisma.labOrder.findUnique(
      args,
    ) as Promise<Prisma.LabOrderGetPayload<T> | null>;
  }
  updateLabOrder(args: Prisma.LabOrderUpdateArgs): Promise<LabOrder> {
    return this.prisma.labOrder.update(args);
  }
  createLabOrder(args: Prisma.LabOrderCreateArgs): Promise<LabOrder> {
    return this.prisma.labOrder.create(args);
  }
  deleteLabOrder(args: Prisma.LabOrderDeleteArgs): Promise<LabOrder> {
    return this.prisma.labOrder.delete(args);
  }

  // Visit Service Order
  countVisitServiceOrder(
    args: Prisma.VisitServiceOrderCountArgs,
  ): Promise<number> {
    return this.prisma.visitServiceOrder.count(args);
  }
  findFirstVisitServiceOrder<T extends Prisma.VisitServiceOrderFindFirstArgs>(
    args: Prisma.SelectSubset<T, Prisma.VisitServiceOrderFindFirstArgs>,
  ): Promise<Prisma.VisitServiceOrderGetPayload<T> | null> {
    return this.prisma.visitServiceOrder.findFirst(
      args,
    ) as Promise<Prisma.VisitServiceOrderGetPayload<T> | null>;
  }
  findManyVisitServiceOrder<T extends Prisma.VisitServiceOrderFindManyArgs>(
    args: Prisma.SelectSubset<T, Prisma.VisitServiceOrderFindManyArgs>,
  ): Promise<Prisma.VisitServiceOrderGetPayload<T>[]> {
    return this.prisma.visitServiceOrder.findMany(args) as Promise<
      Prisma.VisitServiceOrderGetPayload<T>[]
    >;
  }
  findUniqueVisitServiceOrder<T extends Prisma.VisitServiceOrderFindUniqueArgs>(
    args: Prisma.SelectSubset<T, Prisma.VisitServiceOrderFindUniqueArgs>,
  ): Promise<Prisma.VisitServiceOrderGetPayload<T> | null> {
    return this.prisma.visitServiceOrder.findUnique(
      args,
    ) as Promise<Prisma.VisitServiceOrderGetPayload<T> | null>;
  }
  updateVisitServiceOrder(
    args: Prisma.VisitServiceOrderUpdateArgs,
  ): Promise<VisitServiceOrder> {
    return this.prisma.visitServiceOrder.update(args);
  }
  createVisitServiceOrder(
    args: Prisma.VisitServiceOrderCreateArgs,
  ): Promise<VisitServiceOrder> {
    return this.prisma.visitServiceOrder.create(args);
  }
  deleteVisitServiceOrder(
    args: Prisma.VisitServiceOrderDeleteArgs,
  ): Promise<VisitServiceOrder> {
    return this.prisma.visitServiceOrder.delete(args);
  }

  // Prescription
  countPrescription(args: Prisma.PrescriptionCountArgs): Promise<number> {
    return this.prisma.prescription.count(args);
  }
  findManyPrescription<T extends Prisma.PrescriptionFindManyArgs>(
    args: Prisma.SelectSubset<T, Prisma.PrescriptionFindManyArgs>,
  ): Promise<Prisma.PrescriptionGetPayload<T>[]> {
    return this.prisma.prescription.findMany(args) as Promise<
      Prisma.PrescriptionGetPayload<T>[]
    >;
  }
  findUniquePrescription<T extends Prisma.PrescriptionFindUniqueArgs>(
    args: Prisma.SelectSubset<T, Prisma.PrescriptionFindUniqueArgs>,
  ): Promise<Prisma.PrescriptionGetPayload<T> | null> {
    return this.prisma.prescription.findUnique(
      args,
    ) as Promise<Prisma.PrescriptionGetPayload<T> | null>;
  }
  updatePrescription(
    args: Prisma.PrescriptionUpdateArgs,
  ): Promise<Prescription> {
    return this.prisma.prescription.update(args);
  }
  createPrescription(
    args: Prisma.PrescriptionCreateArgs,
  ): Promise<Prescription> {
    return this.prisma.prescription.create(args);
  }
  deletePrescription(
    args: Prisma.PrescriptionDeleteArgs,
  ): Promise<Prescription> {
    return this.prisma.prescription.delete(args);
  }

  // ICD10 Code
  findManyIcd10Code(args: Prisma.Icd10CodeFindManyArgs): Promise<Icd10Code[]> {
    return this.prisma.icd10Code.findMany(args);
  }

  transaction<T>(fn: (tx: TransactionClient) => Promise<T>): Promise<T> {
    return this.prisma.$transaction(fn);
  }
}
