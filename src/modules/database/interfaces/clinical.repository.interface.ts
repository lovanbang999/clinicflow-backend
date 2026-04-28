import {
  MedicalRecord,
  LabOrder,
  VisitServiceOrder,
  Prescription,
  Icd10Code,
  Prisma,
} from '@prisma/client';

export type TransactionClient = Prisma.TransactionClient;

export const I_CLINICAL_REPOSITORY = 'IClinicalRepository';

export interface IClinicalRepository {
  // Medical Record delegates
  countMedicalRecord(args: Prisma.MedicalRecordCountArgs): Promise<number>;
  findFirstMedicalRecord<T extends Prisma.MedicalRecordFindFirstArgs>(
    args: Prisma.SelectSubset<T, Prisma.MedicalRecordFindFirstArgs>,
  ): Promise<Prisma.MedicalRecordGetPayload<T> | null>;
  findManyMedicalRecord<T extends Prisma.MedicalRecordFindManyArgs>(
    args: Prisma.SelectSubset<T, Prisma.MedicalRecordFindManyArgs>,
  ): Promise<Prisma.MedicalRecordGetPayload<T>[]>;
  findUniqueMedicalRecord<T extends Prisma.MedicalRecordFindUniqueArgs>(
    args: Prisma.SelectSubset<T, Prisma.MedicalRecordFindUniqueArgs>,
  ): Promise<Prisma.MedicalRecordGetPayload<T> | null>;
  updateMedicalRecord<T extends Prisma.MedicalRecordUpdateArgs>(
    args: Prisma.SelectSubset<T, Prisma.MedicalRecordUpdateArgs>,
  ): Promise<Prisma.MedicalRecordGetPayload<T>>;
  createMedicalRecord(
    args: Prisma.MedicalRecordCreateArgs,
  ): Promise<MedicalRecord>;

  // Lab Order
  countLabOrder(args: Prisma.LabOrderCountArgs): Promise<number>;
  findFirstLabOrder<T extends Prisma.LabOrderFindFirstArgs>(
    args: Prisma.SelectSubset<T, Prisma.LabOrderFindFirstArgs>,
  ): Promise<Prisma.LabOrderGetPayload<T> | null>;
  findManyLabOrder<T extends Prisma.LabOrderFindManyArgs>(
    args: Prisma.SelectSubset<T, Prisma.LabOrderFindManyArgs>,
  ): Promise<Prisma.LabOrderGetPayload<T>[]>;
  findUniqueLabOrder<T extends Prisma.LabOrderFindUniqueArgs>(
    args: Prisma.SelectSubset<T, Prisma.LabOrderFindUniqueArgs>,
  ): Promise<Prisma.LabOrderGetPayload<T> | null>;
  updateLabOrder(args: Prisma.LabOrderUpdateArgs): Promise<LabOrder>;
  createLabOrder(args: Prisma.LabOrderCreateArgs): Promise<LabOrder>;
  deleteLabOrder(args: Prisma.LabOrderDeleteArgs): Promise<LabOrder>;

  // Visit Service Order
  countVisitServiceOrder(
    args: Prisma.VisitServiceOrderCountArgs,
  ): Promise<number>;
  findFirstVisitServiceOrder<T extends Prisma.VisitServiceOrderFindFirstArgs>(
    args: Prisma.SelectSubset<T, Prisma.VisitServiceOrderFindFirstArgs>,
  ): Promise<Prisma.VisitServiceOrderGetPayload<T> | null>;
  findManyVisitServiceOrder<T extends Prisma.VisitServiceOrderFindManyArgs>(
    args: Prisma.SelectSubset<T, Prisma.VisitServiceOrderFindManyArgs>,
  ): Promise<Prisma.VisitServiceOrderGetPayload<T>[]>;
  findUniqueVisitServiceOrder<T extends Prisma.VisitServiceOrderFindUniqueArgs>(
    args: Prisma.SelectSubset<T, Prisma.VisitServiceOrderFindUniqueArgs>,
  ): Promise<Prisma.VisitServiceOrderGetPayload<T> | null>;
  updateVisitServiceOrder(
    args: Prisma.VisitServiceOrderUpdateArgs,
  ): Promise<VisitServiceOrder>;
  createVisitServiceOrder(
    args: Prisma.VisitServiceOrderCreateArgs,
  ): Promise<VisitServiceOrder>;
  deleteVisitServiceOrder(
    args: Prisma.VisitServiceOrderDeleteArgs,
  ): Promise<VisitServiceOrder>;

  // Prescription
  countPrescription(args: Prisma.PrescriptionCountArgs): Promise<number>;
  findManyPrescription<T extends Prisma.PrescriptionFindManyArgs>(
    args: Prisma.SelectSubset<T, Prisma.PrescriptionFindManyArgs>,
  ): Promise<Prisma.PrescriptionGetPayload<T>[]>;
  findUniquePrescription<T extends Prisma.PrescriptionFindUniqueArgs>(
    args: Prisma.SelectSubset<T, Prisma.PrescriptionFindUniqueArgs>,
  ): Promise<Prisma.PrescriptionGetPayload<T> | null>;
  updatePrescription(
    args: Prisma.PrescriptionUpdateArgs,
  ): Promise<Prescription>;
  createPrescription(
    args: Prisma.PrescriptionCreateArgs,
  ): Promise<Prescription>;
  deletePrescription(
    args: Prisma.PrescriptionDeleteArgs,
  ): Promise<Prescription>;

  // ICD10 Code
  findManyIcd10Code(args: Prisma.Icd10CodeFindManyArgs): Promise<Icd10Code[]>;

  transaction<T>(fn: (tx: TransactionClient) => Promise<T>): Promise<T>;
}
