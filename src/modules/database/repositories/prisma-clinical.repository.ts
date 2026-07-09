import { Injectable, BadRequestException } from '@nestjs/common';
import {
  MedicalRecord,
  LabOrder,
  VisitServiceOrder,
  Prescription,
  Icd10Code,
  Medicine,
  Prisma,
  LabOrderStatus,
  ServiceOrderStatus,
  VisitStep,
  PerformerType,
  BookingStatus,
  LabFormType,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  IClinicalRepository,
  TransactionClient,
} from '../interfaces/clinical.repository.interface';
import {
  DoctorSpecialistQueueItem,
  MedicalRecordDetail,
  PatientHistoryItem,
  AdvancedMedicalRecordWithBooking,
  VisitServiceOrderWorklistItem,
  VisitServiceOrderDetail,
} from '../types/prisma-payload.types';

@Injectable()
export class PrismaClinicalRepository implements IClinicalRepository {
  constructor(private readonly prisma: PrismaService) {}

  private readonly visitIncludes = {
    visitServiceOrders: {
      include: { service: true, performer: true },
      orderBy: { createdAt: 'asc' },
    },
    labOrders: {
      include: { result: true, service: true },
      orderBy: { createdAt: 'asc' },
    },
    prescription: {
      include: { items: { orderBy: { sortOrder: 'asc' } } },
    },
    booking: {
      include: {
        doctor: true,
        patientProfile: true,
      },
    },
  } as const;

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

  async createMedicalRecordForBooking(
    bookingId: string,
    patientProfileId: string,
    doctorId: string,
  ): Promise<MedicalRecord> {
    return this.prisma.medicalRecord.create({
      data: {
        bookingId,
        patientProfileId,
        doctorId,
        isFinalized: false,
      },
    });
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

  async findMedicalRecordByBookingId(
    bookingId: string,
  ): Promise<MedicalRecord | null> {
    return this.prisma.medicalRecord.findUnique({
      where: { bookingId },
    });
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

  async hasAccessToVisitServiceOrder(
    bookingId: string,
    performedByUserId: string,
  ): Promise<boolean> {
    const vso = await this.prisma.visitServiceOrder.findFirst({
      where: {
        medicalRecord: { bookingId },
        performedBy: performedByUserId,
        status: { in: ['PAID', 'IN_PROGRESS'] },
      },
    });
    return !!vso;
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

  // Medicine
  countMedicine(args: Prisma.MedicineCountArgs): Promise<number> {
    return this.prisma.medicine.count(args);
  }

  findManyMedicine<T extends Prisma.MedicineFindManyArgs>(
    args?: Prisma.SelectSubset<T, Prisma.MedicineFindManyArgs>,
  ): Promise<Prisma.MedicineGetPayload<T>[]> {
    return this.prisma.medicine.findMany(args) as Promise<
      Prisma.MedicineGetPayload<T>[]
    >;
  }

  findUniqueMedicine<T extends Prisma.MedicineFindUniqueArgs>(
    args: Prisma.SelectSubset<T, Prisma.MedicineFindUniqueArgs>,
  ): Promise<Prisma.MedicineGetPayload<T> | null> {
    return this.prisma.medicine.findUnique(
      args,
    ) as Promise<Prisma.MedicineGetPayload<T> | null>;
  }

  createMedicine(args: Prisma.MedicineCreateArgs): Promise<Medicine> {
    return this.prisma.medicine.create(args);
  }

  updateMedicine(args: Prisma.MedicineUpdateArgs): Promise<Medicine> {
    return this.prisma.medicine.update(args);
  }

  deleteMedicine(args: Prisma.MedicineDeleteArgs): Promise<Medicine> {
    return this.prisma.medicine.delete(args);
  }

  async findMedicinesWithPagination(
    filters: { isActive?: boolean; search?: string },
    page = 1,
    limit = 10,
  ): Promise<[Medicine[], number]> {
    const { isActive, search } = filters;
    const where: Prisma.MedicineWhereInput = {};

    if (isActive !== undefined) {
      where.isActive = isActive;
    }

    if (search) {
      where.OR = [
        { genericName: { contains: search } },
        { brandName: { contains: search } },
        { code: { contains: search } },
        { notes: { contains: search } },
        { ingredients: { contains: search } },
      ];
    }

    const [medicines, total] = await Promise.all([
      this.prisma.medicine.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.medicine.count({ where }),
    ]);

    return [medicines, total];
  }

  async findMedicineDetail(id: string): Promise<Medicine | null> {
    return this.prisma.medicine.findUnique({
      where: { id },
    });
  }

  async findMedicineByCode(
    code: string,
    excludeId?: string,
  ): Promise<Medicine | null> {
    const where: Prisma.MedicineWhereInput = { code };
    if (excludeId) {
      where.id = { not: excludeId };
    }
    return this.prisma.medicine.findFirst({ where });
  }

  async getMedicineStatistics(): Promise<{
    totalMedicines: number;
    activeMedicines: number;
    outOfStockMedicines: number;
  }> {
    const [totalMedicines, activeMedicines, outOfStockMedicines] =
      await Promise.all([
        this.prisma.medicine.count({}),
        this.prisma.medicine.count({ where: { isActive: true } }),
        this.prisma.medicine.count({ where: { stockQuantity: 0 } }),
      ]);

    return {
      totalMedicines,
      activeMedicines,
      outOfStockMedicines,
    };
  }

  async createMedicinePlain(
    data: Prisma.MedicineCreateInput,
  ): Promise<Medicine> {
    return this.prisma.medicine.create({
      data,
    });
  }

  async updateMedicineById(
    id: string,
    data: Prisma.MedicineUpdateInput,
  ): Promise<Medicine> {
    return this.prisma.medicine.update({
      where: { id },
      data,
    });
  }

  transaction<T>(fn: (tx: TransactionClient) => Promise<T>): Promise<T> {
    return this.prisma.$transaction(fn);
  }

  findPendingLabOrdersForBilling(bookingId: string): Promise<LabOrder[]> {
    return this.prisma.labOrder.findMany({
      where: {
        bookingId,
        status: LabOrderStatus.PENDING,
        invoiceItem: null,
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  findPendingLabsForSync(bookingId: string): Promise<
    Prisma.LabOrderGetPayload<{
      include: { service: { select: { price: true } } };
    }>[]
  > {
    return this.prisma.labOrder.findMany({
      where: {
        bookingId,
        status: LabOrderStatus.PENDING,
      },
      include: { service: { select: { price: true } } },
    });
  }

  findPendingVsosForSync(bookingId: string): Promise<
    Prisma.VisitServiceOrderGetPayload<{
      include: { service: { select: { price: true; name: true } } };
    }>[]
  > {
    return this.prisma.visitServiceOrder.findMany({
      where: {
        bookingId,
        status: ServiceOrderStatus.PENDING,
      },
      include: { service: { select: { price: true, name: true } } },
    });
  }

  async findPaidVsoPerformers(vsoIds: string[]): Promise<string[]> {
    const paidVsos = await this.prisma.visitServiceOrder.findMany({
      where: { id: { in: vsoIds }, performedBy: { not: null } },
      select: { performedBy: true },
    });

    return [
      ...new Set(
        paidVsos
          .map((v) => v.performedBy)
          .filter((id): id is string => id !== null),
      ),
    ];
  }

  async findMedicalRecordDetailByBookingId(
    bookingId: string,
    include?: Prisma.MedicalRecordInclude,
  ): Promise<MedicalRecordDetail | null> {
    return this.prisma.medicalRecord.findUnique({
      where: { bookingId },
      include: include === undefined ? this.visitIncludes : include,
    }) as unknown as Promise<MedicalRecordDetail | null>;
  }

  async saveSymptomsTransaction(
    bookingId: string,
    doctorId: string,
    patientProfileId: string,
    dto: {
      chiefComplaint?: string;
      clinicalFindings?: string;
      doctorNotes?: string;
      bloodPressure?: string;
      heartRate?: number;
      temperature?: number;
      spO2?: number;
      weightKg?: number;
      heightCm?: number;
      bmi?: number;
      medicalHistory?: string;
      allergies?: string;
      additionalSymptoms?: string;
      followUpNote?: string;
    },
    include?: Prisma.MedicalRecordInclude,
  ): Promise<MedicalRecordDetail> {
    const finalInclude = include === undefined ? this.visitIncludes : include;
    return this.prisma.$transaction(async (tx) => {
      return tx.medicalRecord.upsert({
        where: { bookingId },
        create: {
          bookingId,
          patientProfileId,
          doctorId,
          visitStep: VisitStep.SYMPTOMS_TAKEN,
          chiefComplaint: dto.chiefComplaint,
          clinicalFindings: dto.clinicalFindings,
          doctorNotes: dto.doctorNotes,
          bloodPressure: dto.bloodPressure,
          heartRate: dto.heartRate,
          temperature: dto.temperature,
          spO2: dto.spO2,
          weightKg: dto.weightKg,
          heightCm: dto.heightCm,
          bmi: dto.bmi,
          medicalHistory: dto.medicalHistory,
          allergies: dto.allergies,
          additionalSymptoms: dto.additionalSymptoms,
          followUpNote: dto.followUpNote,
          symptomsAt: new Date(),
          version: 1,
        },
        update: {
          chiefComplaint: dto.chiefComplaint,
          clinicalFindings: dto.clinicalFindings,
          doctorNotes: dto.doctorNotes,
          bloodPressure: dto.bloodPressure,
          heartRate: dto.heartRate,
          temperature: dto.temperature,
          spO2: dto.spO2,
          weightKg: dto.weightKg,
          heightCm: dto.heightCm,
          bmi: dto.bmi,
          medicalHistory: dto.medicalHistory,
          allergies: dto.allergies,
          additionalSymptoms: dto.additionalSymptoms,
          followUpNote: dto.followUpNote,
          symptomsAt: new Date(),
          visitStep: VisitStep.SYMPTOMS_TAKEN,
          version: { increment: 1 },
        },
        include: finalInclude,
      });
    }) as unknown as Promise<MedicalRecordDetail>;
  }

  findActiveServicesWithDoctors(serviceIds: string[]): Promise<
    Prisma.ServiceGetPayload<{
      include: {
        doctorServices: {
          include: {
            doctorProfile: {
              include: { user: { select: { id: true } } };
            };
          };
        };
      };
    }>[]
  > {
    return this.prisma.service.findMany({
      where: { id: { in: serviceIds }, isActive: true },
      include: {
        doctorServices: {
          include: {
            doctorProfile: {
              include: { user: { select: { id: true } } },
            },
          },
          take: 1,
        },
      },
    });
  }

  async orderServicesTransaction(
    bookingId: string,
    doctorId: string,
    booking: { patientProfileId: string; doctorId: string },
    servicesWithDoctors: Array<{
      id: string;
      performerType: PerformerType;
      name: string;
      doctorServices?: Array<{
        doctorProfile?: {
          user?: { id: string };
        };
      }>;
    }>,
    items: Array<{
      serviceId: string;
      performedBy?: string | null;
    }>,
    include?: Prisma.MedicalRecordInclude,
  ): Promise<{
    record: MedicalRecordDetail;
    orders: VisitServiceOrder[];
    labOrders: LabOrder[];
  }> {
    const finalInclude = include === undefined ? this.visitIncludes : include;
    return this.prisma.$transaction(async (tx) => {
      let record = await tx.medicalRecord.findUnique({
        where: { bookingId },
      });
      if (!record) {
        record = await tx.medicalRecord.create({
          data: {
            bookingId,
            patientProfileId: booking.patientProfileId,
            doctorId: booking.doctorId,
            visitStep: VisitStep.SYMPTOMS_TAKEN,
          },
        });
      }

      const lockedSteps: VisitStep[] = [
        VisitStep.DIAGNOSED,
        VisitStep.PRESCRIBED,
        VisitStep.COMPLETED,
      ];
      if (lockedSteps.includes(record.visitStep)) {
        throw new BadRequestException(
          'Cannot order services after diagnosis is finalized',
        );
      }

      const existing = await tx.visitServiceOrder.findMany({
        where: { medicalRecordId: record.id },
        select: { serviceId: true },
      });
      const existingIds = new Set(existing.map((o) => o.serviceId));
      const newItems = items.filter((i) => !existingIds.has(i.serviceId));

      if (newItems.length > 0) {
        for (const item of newItems) {
          const serviceId = item.serviceId;
          const svc = servicesWithDoctors.find((s) => s.id === serviceId);
          if (!svc) continue;

          if (svc.performerType === PerformerType.TECHNICIAN) {
            await tx.labOrder.create({
              data: {
                medicalRecordId: record.id,
                serviceId,
                patientProfileId: booking.patientProfileId,
                bookingId,
                doctorId: booking.doctorId,
                testName: svc.name,
                status: LabOrderStatus.PENDING,
              },
            });
          } else {
            const specialistUserId =
              item.performedBy ??
              svc?.doctorServices?.[0]?.doctorProfile?.user?.id ??
              null;

            await tx.visitServiceOrder.create({
              data: {
                medicalRecordId: record.id,
                serviceId,
                patientProfileId: booking.patientProfileId,
                bookingId,
                orderedBy: doctorId,
                performedBy: specialistUserId,
                status: ServiceOrderStatus.PENDING,
              },
            });
          }
        }
      }

      const newStep: VisitStep =
        record.visitStep === VisitStep.SYMPTOMS_TAKEN ||
        record.visitStep === VisitStep.SERVICES_ORDERED
          ? VisitStep.SERVICES_ORDERED
          : VisitStep.AWAITING_RESULTS;

      const updated = await tx.medicalRecord.update({
        where: { id: record.id },
        data: {
          visitStep: newStep,
          orderedAt: new Date(),
          version: { increment: 1 },
        },
        include: finalInclude,
      });

      const vsoOrders = await tx.visitServiceOrder.findMany({
        where: { medicalRecordId: record.id },
        include: { service: true },
      });

      const labOrders = await tx.labOrder.findMany({
        where: { medicalRecordId: record.id },
        include: { service: true },
      });

      return {
        record: updated as unknown as MedicalRecordDetail,
        orders: vsoOrders,
        labOrders,
      };
    });
  }

  async savePrescriptionTransaction(
    bookingId: string,
    doctorId: string,
    recordId: string,
    patientProfileId: string,
    oldBookingStatus: string,
    dto: {
      notes?: string;
      items?: Array<{
        visitServiceOrderId?: string;
        labOrderId?: string;
        medicineName: string;
        dosage: string;
        frequency: string;
        durationDays?: number;
        quantity: number;
        unit?: string;
        instructions?: string;
        sortOrder?: number;
        medicineId?: string;
        unitPrice?: number;
      }>;
    },
    include?: Prisma.MedicalRecordInclude,
  ): Promise<MedicalRecordDetail | null> {
    const finalInclude = include === undefined ? this.visitIncludes : include;
    return this.prisma.$transaction(async (tx) => {
      const prescription = await tx.prescription.upsert({
        where: { medicalRecordId: recordId },
        create: {
          medicalRecordId: recordId,
          patientProfileId,
          doctorId,
          notes: dto.notes,
          isFulfilledInternally: null,
        },
        update: { notes: dto.notes },
      });

      await tx.prescriptionItem.deleteMany({
        where: { prescriptionId: prescription.id },
      });

      if (dto.items && dto.items.length > 0) {
        await tx.prescriptionItem.createMany({
          data: dto.items.map((item, idx: number) => ({
            prescriptionId: prescription.id,
            visitServiceOrderId: item.visitServiceOrderId,
            labOrderId: item.labOrderId,
            medicineName: item.medicineName,
            dosage: item.dosage,
            frequency: item.frequency,
            durationDays: item.durationDays,
            quantity: item.quantity,
            unit: item.unit ?? 'viên',
            instructions: item.instructions,
            sortOrder: item.sortOrder ?? idx,
            medicineId: item.medicineId || null,
            unitPrice: item.unitPrice ?? null,
          })),
        });
      }

      await tx.medicalRecord.update({
        where: { id: recordId },
        data: {
          visitStep: VisitStep.COMPLETED,
          isFinalized: true,
          prescribedAt: new Date(),
          version: { increment: 1 },
        },
      });

      await tx.booking.update({
        where: { id: bookingId },
        data: { status: 'COMPLETED', doctorNotes: dto.notes },
      });

      await tx.bookingStatusHistory.create({
        data: {
          bookingId,
          oldStatus: oldBookingStatus as BookingStatus,
          newStatus: 'COMPLETED',
          changedById: doctorId,
          reason: 'Prescription issued — visit finalized',
        },
      });

      return tx.medicalRecord.findUnique({
        where: { id: recordId },
        include: finalInclude,
      });
    }) as unknown as Promise<MedicalRecordDetail | null>;
  }

  async searchICD10(query: string): Promise<Icd10Code[]> {
    if (!query) {
      return this.prisma.icd10Code.findMany({
        take: 10,
        orderBy: { code: 'asc' },
      });
    }
    return this.prisma.icd10Code.findMany({
      where: {
        OR: [{ code: { contains: query } }, { name: { contains: query } }],
      },
      take: 20,
      orderBy: { code: 'asc' },
    });
  }

  async searchMedicines(query: string): Promise<Medicine[]> {
    if (!query) {
      return this.prisma.medicine.findMany({
        where: { isActive: true },
        take: 10,
        orderBy: { brandName: 'asc' },
      });
    }
    return this.prisma.medicine.findMany({
      where: {
        isActive: true,
        OR: [
          { brandName: { contains: query } },
          { genericName: { contains: query } },
        ],
      },
      take: 20,
      orderBy: { brandName: 'asc' },
    });
  }

  async findPatientHistory(
    patientProfileId: string,
    skip: number,
    limit: number,
  ): Promise<[PatientHistoryItem[], number]> {
    const include = {
      booking: {
        include: {
          doctor: { select: { id: true, fullName: true } },
          service: { select: { id: true, name: true } },
        },
      },
      visitServiceOrders: { include: { service: true } },
      labOrders: { include: { service: true } },
      prescription: {
        include: { items: { orderBy: { sortOrder: 'asc' } } },
      },
    } as const;

    return Promise.all([
      this.prisma.medicalRecord.findMany({
        where: { patientProfileId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include,
      }),
      this.prisma.medicalRecord.count({
        where: { patientProfileId },
      }),
    ]) as unknown as Promise<[PatientHistoryItem[], number]>;
  }

  async getPatientClinicalStats(
    patientProfileId: string,
    startOfYear: Date,
  ): Promise<{
    totalVisits: number;
    visitsThisYear: number;
    abnormalResults: number;
  }> {
    const [totalVisits, visitsThisYear, abnormalResults] = await Promise.all([
      this.prisma.medicalRecord.count({
        where: { patientProfileId },
      }),
      this.prisma.medicalRecord.count({
        where: {
          patientProfileId,
          createdAt: { gte: startOfYear },
        },
      }),
      this.prisma.visitServiceOrder.count({
        where: {
          patientProfileId,
          isAbnormal: true,
        },
      }),
    ]);

    return {
      totalVisits,
      visitsThisYear,
      abnormalResults,
    };
  }

  async getDoctorClinicalStats(
    doctorId: string,
    startOfToday: Date,
  ): Promise<{ abnormalLabsToday: number; abnormalVsoToday: number }> {
    const [abnormalLabsToday, abnormalVsoToday] = await Promise.all([
      this.prisma.labOrder.count({
        where: {
          doctorId,
          result: {
            isAbnormal: true,
            createdAt: { gte: startOfToday },
          },
        },
      }),
      this.prisma.visitServiceOrder.count({
        where: {
          orderedBy: doctorId,
          isAbnormal: true,
          completedAt: { gte: startOfToday },
        },
      }),
    ]);

    return {
      abnormalLabsToday,
      abnormalVsoToday,
    };
  }

  async fulfillPrescriptionTransaction(
    prescriptionId: string,
    pharmacyInvoiceId?: string,
  ): Promise<Prescription> {
    return this.prisma.$transaction(async (tx) => {
      return tx.prescription.update({
        where: { id: prescriptionId },
        data: {
          isFulfilledInternally: true,
          fulfilledAt: new Date(),
          ...(pharmacyInvoiceId ? { pharmacyInvoiceId } : {}),
        },
      });
    });
  }

  async startSpecialistExaminationTransaction(
    vsoId: string,
    bookingId: string | null,
    doctorId: string,
    prevBookingStatus?: string,
  ): Promise<VisitServiceOrder> {
    return this.prisma.$transaction(async (tx) => {
      const updatedVso = await tx.visitServiceOrder.update({
        where: { id: vsoId },
        data: { status: ServiceOrderStatus.IN_PROGRESS },
      });

      if (bookingId) {
        await tx.booking.update({
          where: { id: bookingId },
          data: { status: 'AWAITING_RESULTS' },
        });

        await tx.bookingStatusHistory.create({
          data: {
            bookingId,
            oldStatus: (prevBookingStatus ?? 'CHECKED_IN') as BookingStatus,
            newStatus: 'AWAITING_RESULTS',
            changedById: doctorId,
            reason: 'Specialist examination started',
          },
        });
      }

      return updatedVso;
    });
  }

  async completeSpecialistExaminationTransaction(
    vsoId: string,
    dto: {
      resultText?: string;
      doctorNotes?: string;
      isAbnormal?: boolean;
      abnormalNote?: string;
      findings?: Prisma.InputJsonValue;
    },
    include?: Prisma.MedicalRecordInclude,
  ): Promise<{
    updatedVso: VisitServiceOrder;
    advanced: boolean;
    record?: MedicalRecordDetail | null;
  }> {
    const finalInclude = include === undefined ? this.visitIncludes : include;
    return this.prisma.$transaction(async (tx) => {
      const updatedVso = await tx.visitServiceOrder.update({
        where: { id: vsoId },
        data: {
          status: ServiceOrderStatus.COMPLETED,
          resultText: dto.resultText,
          specialistNote: dto.doctorNotes,
          isAbnormal: dto.isAbnormal,
          abnormalNote: dto.abnormalNote,
          findings: dto.findings as Prisma.InputJsonValue,
          completedAt: new Date(),
        },
      });

      const advResult = await this.maybeAdvanceToResultsReady(
        tx,
        updatedVso.medicalRecordId,
        finalInclude,
      );

      return {
        updatedVso,
        advanced: advResult.advanced,
        record: advResult.record,
      };
    });
  }

  async checkAndAdvanceToResultsReadyTransaction(
    medicalRecordId: string,
    include?: Prisma.MedicalRecordInclude,
  ): Promise<{ advanced: boolean; record?: MedicalRecordDetail | null }> {
    const finalInclude = include === undefined ? this.visitIncludes : include;
    return this.prisma.$transaction(async (tx) => {
      return this.maybeAdvanceToResultsReady(tx, medicalRecordId, finalInclude);
    });
  }

  private async maybeAdvanceToResultsReady(
    tx: TransactionClient,
    medicalRecordId: string,
    include?: Prisma.MedicalRecordInclude,
  ): Promise<{ advanced: boolean; record?: MedicalRecordDetail | null }> {
    const finalInclude = include === undefined ? this.visitIncludes : include;
    const allVso = await tx.visitServiceOrder.findMany({
      where: { medicalRecordId },
      select: { status: true },
    });

    const allLabs = await tx.labOrder.findMany({
      where: { medicalRecordId },
      select: { status: true },
    });

    if (allVso.length === 0 && allLabs.length === 0) {
      return { advanced: false };
    }

    const allVsoDone = allVso.every(
      (o) =>
        o.status === ServiceOrderStatus.COMPLETED ||
        o.status === ServiceOrderStatus.CANCELLED,
    );
    const allLabsDone = allLabs.every(
      (o) =>
        o.status === LabOrderStatus.COMPLETED ||
        o.status === LabOrderStatus.CANCELLED,
    );

    const record = await tx.medicalRecord.findUnique({
      where: { id: medicalRecordId },
      include: {
        booking: {
          include: { patientProfile: true },
        },
      },
    });

    if (allVsoDone && allLabsDone) {
      const allowedSteps: VisitStep[] = [
        VisitStep.SERVICES_ORDERED,
        VisitStep.AWAITING_RESULTS,
      ];

      if (record && allowedSteps.includes(record.visitStep)) {
        await tx.medicalRecord.update({
          where: { id: medicalRecordId },
          data: {
            visitStep: VisitStep.RESULTS_READY,
            version: { increment: 1 },
          },
        });

        const updatedRecord = await tx.medicalRecord.findUnique({
          where: { id: medicalRecordId },
          include: finalInclude,
        });

        return {
          advanced: true,
          record: updatedRecord as unknown as MedicalRecordDetail,
        };
      }
    }

    return {
      advanced: false,
      record: record as unknown as MedicalRecordDetail,
    };
  }

  async findVisitServiceOrderById(
    id: string,
  ): Promise<VisitServiceOrder | null> {
    return this.prisma.visitServiceOrder.findUnique({
      where: { id },
    });
  }

  async deleteVisitServiceOrderById(id: string): Promise<VisitServiceOrder> {
    return this.prisma.visitServiceOrder.delete({
      where: { id },
    });
  }

  async countVisitServiceOrdersByMedicalRecordId(
    medicalRecordId: string,
  ): Promise<number> {
    return this.prisma.visitServiceOrder.count({
      where: { medicalRecordId },
    });
  }

  async saveDiagnosis(
    recordId: string,
    dto: {
      diagnosisCode?: string;
      diagnosisName?: string;
      treatmentPlan?: string;
      doctorNotes?: string;
      followUpDate?: string | Date;
      followUpNote?: string;
    },
    include?: Prisma.MedicalRecordInclude,
  ): Promise<MedicalRecordDetail> {
    const finalInclude = include === undefined ? this.visitIncludes : include;
    return this.prisma.medicalRecord.update({
      where: { id: recordId },
      data: {
        diagnosisCode: dto.diagnosisCode,
        diagnosisName: dto.diagnosisName,
        treatmentPlan: dto.treatmentPlan,
        doctorNotes: dto.doctorNotes,
        followUpDate: dto.followUpDate ? new Date(dto.followUpDate) : null,
        followUpNote: dto.followUpNote,
        visitStep: VisitStep.DIAGNOSED,
        diagnosedAt: new Date(),
        version: { increment: 1 },
      },
      include: finalInclude,
    }) as unknown as Promise<MedicalRecordDetail>;
  }

  async createLabOrderTransaction(
    bookingId: string,
    patientProfileId: string,
    doctorId: string,
    medicalRecordId: string,
    currentVisitStep: string | null,
    dto: {
      testName: string;
      testDescription?: string;
      serviceId?: string;
      assignedTechnicianId?: string;
    },
  ): Promise<LabOrder> {
    return this.prisma.$transaction(async (tx) => {
      if (currentVisitStep === 'SYMPTOMS_TAKEN') {
        await tx.medicalRecord.update({
          where: { id: medicalRecordId },
          data: {
            visitStep: VisitStep.SERVICES_ORDERED,
            orderedAt: new Date(),
          },
        });
      }

      return tx.labOrder.create({
        data: {
          bookingId,
          medicalRecordId,
          patientProfileId,
          doctorId,
          testName: dto.testName,
          testDescription: dto.testDescription,
          serviceId: dto.serviceId,
          assignedTechnicianId: dto.assignedTechnicianId ?? null,
          status: LabOrderStatus.PENDING,
        },
      });
    });
  }

  async findLabOrdersByBookingId(bookingId: string): Promise<
    Prisma.LabOrderGetPayload<{
      include: {
        result: true;
        service: {
          select: {
            id: true;
            name: true;
            labFormType: true;
          };
        };
        invoiceItem: {
          include: {
            invoice: {
              select: { id: true; invoiceNumber: true; status: true };
            };
          };
        };
      };
    }>[]
  > {
    return this.prisma.labOrder.findMany({
      where: { bookingId },
      include: {
        result: true,
        service: {
          select: {
            id: true,
            name: true,
            labFormType: true,
          },
        },
        invoiceItem: {
          include: {
            invoice: {
              select: { id: true, invoiceNumber: true, status: true },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findPendingLabOrders(): Promise<
    Prisma.LabOrderGetPayload<{
      include: {
        booking: {
          select: {
            bookingCode: true;
            doctor: {
              select: { fullName: true };
            };
            patientProfile: {
              select: {
                fullName: true;
                patientCode: true;
                gender: true;
                dateOfBirth: true;
              };
            };
          };
        };
      };
    }>[]
  > {
    return this.prisma.labOrder.findMany({
      where: {
        status: {
          in: [LabOrderStatus.PENDING, LabOrderStatus.IN_PROGRESS],
        },
      },
      include: {
        booking: {
          select: {
            bookingCode: true,
            doctor: {
              select: { fullName: true },
            },
            patientProfile: {
              select: {
                fullName: true,
                patientCode: true,
                gender: true,
                dateOfBirth: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findLabOrderWithRelations(
    id: string,
  ): Promise<Prisma.LabOrderGetPayload<{
    include: {
      result: true;
      medicalRecord: {
        select: {
          bloodPressure: true;
          heartRate: true;
          temperature: true;
          spO2: true;
          weightKg: true;
          heightCm: true;
          bmi: true;
          chiefComplaint: true;
          clinicalFindings: true;
          doctorNotes: true;
          allergies: true;
          diagnosisName: true;
        };
      };
      service: {
        select: {
          id: true;
          name: true;
          labFormType: true;
        };
      };
      booking: {
        select: {
          id: true;
          bookingCode: true;
          doctorId: true;
          patientProfileId: true;
          doctor: {
            select: {
              fullName: true;
              doctorProfile: { select: { specialties: true } };
            };
          };
          patientProfile: {
            select: {
              fullName: true;
              patientCode: true;
              gender: true;
              dateOfBirth: true;
            };
          };
        };
      };
    };
  }> | null> {
    return this.prisma.labOrder.findUnique({
      where: { id },
      include: {
        result: true,
        medicalRecord: {
          select: {
            bloodPressure: true,
            heartRate: true,
            temperature: true,
            spO2: true,
            weightKg: true,
            heightCm: true,
            bmi: true,
            chiefComplaint: true,
            clinicalFindings: true,
            doctorNotes: true,
            allergies: true,
            diagnosisName: true,
          },
        },
        service: {
          select: {
            id: true,
            name: true,
            labFormType: true,
          },
        },
        booking: {
          select: {
            id: true,
            bookingCode: true,
            doctorId: true,
            patientProfileId: true,
            doctor: {
              select: {
                fullName: true,
                doctorProfile: { select: { specialties: true } },
              },
            },
            patientProfile: {
              select: {
                fullName: true,
                patientCode: true,
                gender: true,
                dateOfBirth: true,
              },
            },
          },
        },
      },
    });
  }

  async findRecentCompletedLabOrders(
    patientProfileId: string,
    excludeOrderId: string,
    testName: string,
    serviceId?: string,
  ): Promise<
    Prisma.LabOrderGetPayload<{
      include: {
        result: true;
        assignedTechnician: { select: { fullName: true } };
      };
    }>[]
  > {
    return this.prisma.labOrder.findMany({
      where: {
        patientProfileId,
        id: { not: excludeOrderId },
        status: LabOrderStatus.COMPLETED,
        OR: [...(serviceId ? [{ serviceId }] : []), { testName }],
      },
      include: {
        result: true,
        assignedTechnician: { select: { fullName: true } },
      },
      orderBy: { updatedAt: 'desc' },
      take: 3,
    });
  }

  async findReadyToPerformLabOrders(
    technicianId?: string,
    technicianCategoryIds?: string[],
    hasSpecializations?: boolean,
    isAdminOrReceptionist?: boolean,
  ): Promise<
    Prisma.LabOrderGetPayload<{
      include: {
        service: {
          select: {
            id: true;
            name: true;
            labFormType: true;
            categoryId: true;
          };
        };
        booking: {
          select: {
            bookingCode: true;
            doctor: { select: { fullName: true } };
            patientProfile: {
              select: {
                fullName: true;
                patientCode: true;
                gender: true;
                dateOfBirth: true;
              };
            };
          };
        };
        assignedTechnician: {
          select: { id: true; fullName: true; avatar: true };
        };
      };
    }>[]
  > {
    let whereClause: Prisma.LabOrderWhereInput;

    if (isAdminOrReceptionist || !technicianId) {
      whereClause = {
        status: { in: [LabOrderStatus.PAID, LabOrderStatus.IN_PROGRESS] },
      };
    } else if (!hasSpecializations) {
      whereClause = {
        status: { in: [LabOrderStatus.PAID, LabOrderStatus.IN_PROGRESS] },
        OR: [
          { assignedTechnicianId: null },
          { assignedTechnicianId: technicianId },
        ],
      };
    } else {
      whereClause = {
        status: { in: [LabOrderStatus.PAID, LabOrderStatus.IN_PROGRESS] },
        OR: [
          { assignedTechnicianId: technicianId },
          {
            assignedTechnicianId: null,
            service: { categoryId: { in: technicianCategoryIds } },
          },
          {
            assignedTechnicianId: null,
            serviceId: null,
          },
        ],
      };
    }

    return this.prisma.labOrder.findMany({
      where: whereClause,
      include: {
        service: {
          select: {
            id: true,
            name: true,
            labFormType: true,
            categoryId: true,
          },
        },
        booking: {
          select: {
            bookingCode: true,
            doctor: { select: { fullName: true } },
            patientProfile: {
              select: {
                fullName: true,
                patientCode: true,
                gender: true,
                dateOfBirth: true,
              },
            },
          },
        },
        assignedTechnician: {
          select: { id: true, fullName: true, avatar: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getTechnicianStats(
    startOfDay: Date,
    endOfDay: Date,
  ): Promise<{ pending: number; inProgress: number; completedToday: number }> {
    const [pending, inProgress, completedToday] = await Promise.all([
      this.prisma.labOrder.count({
        where: { status: LabOrderStatus.PAID },
      }),
      this.prisma.labOrder.count({
        where: { status: LabOrderStatus.IN_PROGRESS },
      }),
      this.prisma.labOrder.count({
        where: {
          status: LabOrderStatus.COMPLETED,
          updatedAt: {
            gte: startOfDay,
            lte: endOfDay,
          },
        },
      }),
    ]);

    return { pending, inProgress, completedToday };
  }

  async findTechnicianHistoryPaginated(params: {
    userId?: string;
    isTechnician: boolean;
    startDate?: Date;
    endDate?: Date;
    categoryId?: string;
    labFormType?: string;
    search?: string;
    skip: number;
    take: number;
  }): Promise<
    [
      Prisma.LabOrderGetPayload<{
        include: {
          result: true;
          service: {
            select: {
              id: true;
              name: true;
              labFormType: true;
              categoryId: true;
            };
          };
          booking: {
            select: {
              bookingCode: true;
              doctor: {
                select: {
                  fullName: true;
                  doctorProfile: { select: { specialties: true } };
                };
              };
              patientProfile: {
                select: {
                  fullName: true;
                  patientCode: true;
                  gender: true;
                  dateOfBirth: true;
                };
              };
            };
          };
        };
      }>[],
      number,
    ]
  > {
    const where: Prisma.LabOrderWhereInput = {
      status: LabOrderStatus.COMPLETED,
    };

    if (params.isTechnician && params.userId) {
      where.OR = [
        { assignedTechnicianId: params.userId },
        { result: { recordedBy: params.userId } },
      ];
    }

    if (params.startDate || params.endDate) {
      where.updatedAt = {};
      if (params.startDate) {
        where.updatedAt.gte = params.startDate;
      }
      if (params.endDate) {
        where.updatedAt.lte = params.endDate;
      }
    }

    if (params.categoryId || params.labFormType) {
      where.service = {};
      if (params.categoryId) {
        where.service.categoryId = params.categoryId;
      }
      if (params.labFormType) {
        where.service.labFormType = params.labFormType as LabFormType;
      }
    }

    if (params.search) {
      where.booking = {
        OR: [
          { bookingCode: { contains: params.search } },
          {
            patientProfile: {
              OR: [
                { fullName: { contains: params.search } },
                { patientCode: { contains: params.search } },
              ],
            },
          },
        ],
      };
    }

    const [total, items] = await Promise.all([
      this.prisma.labOrder.count({ where }),
      this.prisma.labOrder.findMany({
        where,
        include: {
          result: true,
          service: {
            select: {
              id: true,
              name: true,
              labFormType: true,
              categoryId: true,
            },
          },
          booking: {
            select: {
              bookingCode: true,
              doctor: {
                select: {
                  fullName: true,
                  doctorProfile: { select: { specialties: true } },
                },
              },
              patientProfile: {
                select: {
                  fullName: true,
                  patientCode: true,
                  gender: true,
                  dateOfBirth: true,
                },
              },
            },
          },
        },
        orderBy: { updatedAt: 'desc' },
        skip: params.skip,
        take: params.take,
      }),
    ]);

    return [items, total];
  }

  async uploadLabResultTransaction(
    labOrderId: string,
    resultAuthorId: string,
    dto: {
      resultText?: string;
      resultFileUrl?: string;
      isAbnormal?: boolean;
      abnormalNote?: string;
    },
  ): Promise<LabOrder> {
    return this.prisma.$transaction(async (tx) => {
      await tx.labResult.upsert({
        where: { labOrderId },
        create: {
          labOrderId,
          resultText: dto.resultText,
          resultFileUrl: dto.resultFileUrl,
          isAbnormal: dto.isAbnormal,
          abnormalNote: dto.abnormalNote,
          recordedBy: resultAuthorId,
          resultDate: new Date(),
        },
        update: {
          resultText: dto.resultText,
          resultFileUrl: dto.resultFileUrl,
          isAbnormal: dto.isAbnormal,
          abnormalNote: dto.abnormalNote,
          recordedBy: resultAuthorId,
          resultDate: new Date(),
        },
      });

      return tx.labOrder.update({
        where: { id: labOrderId },
        data: { status: LabOrderStatus.COMPLETED },
        include: { result: true },
      });
    });
  }

  async updateLabOrderStatus(
    labOrderId: string,
    status: string,
  ): Promise<LabOrder> {
    return this.prisma.labOrder.update({
      where: { id: labOrderId },
      data: { status: status as LabOrderStatus },
    });
  }

  async findLabOrderForDeletion(id: string): Promise<Prisma.LabOrderGetPayload<{
    include: {
      invoiceItem: {
        include: {
          invoice: {
            select: { id: true; status: true };
          };
        };
      };
    };
  }> | null> {
    return this.prisma.labOrder.findUnique({
      where: { id },
      include: {
        invoiceItem: {
          include: {
            invoice: {
              select: { id: true, status: true },
            },
          },
        },
      },
    });
  }

  async deleteLabOrderById(id: string): Promise<LabOrder> {
    return this.prisma.labOrder.delete({
      where: { id },
    });
  }

  async findVisitServiceOrdersWorklist(
    status?: string,
  ): Promise<VisitServiceOrderWorklistItem[]> {
    const where: Prisma.VisitServiceOrderWhereInput = {
      status: status
        ? (status as ServiceOrderStatus)
        : {
            in: [ServiceOrderStatus.PENDING, ServiceOrderStatus.IN_PROGRESS],
          },
      service: {
        performerType: PerformerType.DOCTOR,
      },
    };

    return this.prisma.visitServiceOrder.findMany({
      where,
      orderBy: [{ status: 'asc' }, { createdAt: 'asc' }],
      include: {
        service: {
          select: { id: true, name: true, category: true, serviceCode: true },
        },
        medicalRecord: {
          include: {
            booking: {
              include: {
                patientProfile: {
                  select: {
                    id: true,
                    patientCode: true,
                    fullName: true,
                    phone: true,
                    gender: true,
                    dateOfBirth: true,
                  },
                },
                doctor: { select: { id: true, fullName: true } },
              },
            },
          },
        },
      },
    }) as unknown as Promise<VisitServiceOrderWorklistItem[]>;
  }

  async startVisitServiceOrder(
    orderId: string,
    technicianId: string,
  ): Promise<VisitServiceOrder> {
    return this.prisma.visitServiceOrder.update({
      where: { id: orderId },
      data: {
        status: ServiceOrderStatus.IN_PROGRESS,
        performedBy: technicianId,
        startedAt: new Date(),
      },
    });
  }

  async completeVisitServiceOrderTransaction(
    orderId: string,
    technicianId: string,
    dto: {
      resultText?: string;
      findings?: Prisma.InputJsonValue;
      resultFileUrl?: string;
      isAbnormal?: boolean;
      abnormalNote?: string;
    },
  ): Promise<{
    completedOrder: VisitServiceOrder;
    advanced: boolean;
    record?: AdvancedMedicalRecordWithBooking | null;
  }> {
    return this.prisma.$transaction(async (tx) => {
      const completedOrder = await tx.visitServiceOrder.update({
        where: { id: orderId },
        data: {
          status: ServiceOrderStatus.COMPLETED,
          performedBy: technicianId,
          resultText: dto.resultText,
          findings: dto.findings as Prisma.InputJsonValue,
          resultFileUrl: dto.resultFileUrl,
          isAbnormal: dto.isAbnormal,
          abnormalNote: dto.abnormalNote,
          completedAt: new Date(),
        },
      });

      // Auto-advance MedicalRecord to RESULTS_READY if all sibling orders are done
      const allSiblings = await tx.visitServiceOrder.findMany({
        where: { medicalRecordId: completedOrder.medicalRecordId },
        select: { id: true, status: true },
      });

      const allLabs = await tx.labOrder.findMany({
        where: { medicalRecordId: completedOrder.medicalRecordId },
        select: { status: true },
      });

      const allVsoDone = allSiblings.every(
        (o) =>
          o.id === orderId ||
          o.status === ServiceOrderStatus.COMPLETED ||
          o.status === ServiceOrderStatus.CANCELLED,
      );
      const allLabsDone = allLabs.every(
        (o) =>
          o.status === LabOrderStatus.COMPLETED ||
          o.status === LabOrderStatus.CANCELLED,
      );

      if (allVsoDone && allLabsDone) {
        const record = await tx.medicalRecord.findUnique({
          where: { id: completedOrder.medicalRecordId },
          include: {
            booking: {
              include: { patientProfile: true },
            },
          },
        });

        // Only advance if currently AWAITING_RESULTS; never step backward
        if (record && record.visitStep === VisitStep.AWAITING_RESULTS) {
          await tx.medicalRecord.update({
            where: { id: completedOrder.medicalRecordId },
            data: {
              visitStep: VisitStep.RESULTS_READY,
              version: { increment: 1 },
            },
          });

          const updatedRecord = await tx.medicalRecord.findUnique({
            where: { id: completedOrder.medicalRecordId },
            include: {
              booking: {
                include: { patientProfile: true },
              },
            },
          });

          return {
            completedOrder,
            advanced: true,
            record:
              updatedRecord as unknown as AdvancedMedicalRecordWithBooking,
          };
        }
        return {
          completedOrder,
          advanced: false,
          record: record as unknown as AdvancedMedicalRecordWithBooking,
        };
      }

      return { completedOrder, advanced: false };
    });
  }

  async findVisitServiceOrderDetailById(
    orderId: string,
  ): Promise<VisitServiceOrderDetail | null> {
    return this.prisma.visitServiceOrder.findUnique({
      where: { id: orderId },
      include: {
        service: true,
        medicalRecord: {
          include: {
            booking: {
              include: {
                patientProfile: true,
                doctor: { select: { id: true, fullName: true } },
              },
            },
          },
        },
      },
    }) as unknown as Promise<VisitServiceOrderDetail | null>;
  }

  async findDoctorSpecialistQueue(
    doctorId: string,
    startDate?: Date,
    endDate?: Date,
  ): Promise<DoctorSpecialistQueueItem[]> {
    const vsoStatusFilter = [
      ServiceOrderStatus.PAID,
      ServiceOrderStatus.IN_PROGRESS,
    ];
    const where: Prisma.VisitServiceOrderWhereInput = {
      performedBy: doctorId,
      status: { in: vsoStatusFilter },
    };

    if (startDate && endDate) {
      where.createdAt = {
        gte: startDate,
        lte: endDate,
      };
    }

    return this.prisma.visitServiceOrder.findMany({
      where,
      include: {
        service: { select: { id: true, name: true } },
        medicalRecord: {
          include: {
            booking: {
              include: {
                patientProfile: true,
                doctor: true,
                service: true,
                medicalRecord: {
                  select: {
                    id: true,
                    isFinalized: true,
                    chiefComplaint: true,
                    clinicalFindings: true,
                    diagnosisCode: true,
                    diagnosisName: true,
                    treatmentPlan: true,
                    doctorNotes: true,
                    followUpDate: true,
                    followUpNote: true,
                  },
                },
              },
            },
          },
        },
      },
      orderBy: { queueNumber: 'asc' },
    });
  }

  async findMedicalRecordsForVisitTrend(filter: {
    patientProfileId: string;
    gte: Date;
  }): Promise<Array<{ createdAt: Date }>> {
    return this.prisma.medicalRecord.findMany({
      where: {
        patientProfileId: filter.patientProfileId,
        createdAt: { gte: filter.gte },
      },
      select: { createdAt: true },
    });
  }

  async findDiagnosisRecords(filter: {
    patientProfileId?: string;
    doctorId?: string;
  }): Promise<
    Array<{ diagnosisCode: string | null; diagnosisName: string | null }>
  > {
    const where: Prisma.MedicalRecordWhereInput = {
      diagnosisName: { not: null },
    };
    if (filter.patientProfileId)
      where.patientProfileId = filter.patientProfileId;
    if (filter.doctorId) where.doctorId = filter.doctorId;

    return this.prisma.medicalRecord.findMany({
      where,
      select: { diagnosisCode: true, diagnosisName: true },
    });
  }

  async findMedicalRecordsForKPIs(filter: {
    doctorId: string;
    gte: Date;
  }): Promise<
    Array<{
      patientProfileId: string;
      diagnosisCode: string | null;
      followUpDate: Date | null;
      labOrders: Array<{ id: string }>;
    }>
  > {
    return (await this.prisma.medicalRecord.findMany({
      where: {
        doctorId: filter.doctorId,
        createdAt: { gte: filter.gte },
      },
      select: {
        patientProfileId: true,
        diagnosisCode: true,
        followUpDate: true,
        labOrders: { select: { id: true } },
      },
    })) as unknown as Array<{
      patientProfileId: string;
      diagnosisCode: string | null;
      followUpDate: Date | null;
      labOrders: Array<{ id: string }>;
    }>;
  }
}
