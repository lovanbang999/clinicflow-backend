import {
  MedicalRecord,
  LabOrder,
  VisitServiceOrder,
  Prescription,
  Icd10Code,
  Medicine,
  Prisma,
  PerformerType,
} from '@prisma/client';
import {
  DoctorSpecialistQueueItem,
  MedicalRecordDetail,
  PatientHistoryItem,
  AdvancedMedicalRecordWithBooking,
  VisitServiceOrderWorklistItem,
  VisitServiceOrderDetail,
} from '../types/prisma-payload.types';

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
  createMedicalRecordForBooking(
    bookingId: string,
    patientProfileId: string,
    doctorId: string,
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

  findMedicalRecordByBookingId(
    bookingId: string,
  ): Promise<MedicalRecord | null>;

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
  hasAccessToVisitServiceOrder(
    bookingId: string,
    performedByUserId: string,
  ): Promise<boolean>;

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

  // Medicine
  countMedicine(args: Prisma.MedicineCountArgs): Promise<number>;
  findManyMedicine<T extends Prisma.MedicineFindManyArgs>(
    args?: Prisma.SelectSubset<T, Prisma.MedicineFindManyArgs>,
  ): Promise<Prisma.MedicineGetPayload<T>[]>;
  findUniqueMedicine<T extends Prisma.MedicineFindUniqueArgs>(
    args: Prisma.SelectSubset<T, Prisma.MedicineFindUniqueArgs>,
  ): Promise<Prisma.MedicineGetPayload<T> | null>;
  createMedicine(args: Prisma.MedicineCreateArgs): Promise<Medicine>;
  updateMedicine(args: Prisma.MedicineUpdateArgs): Promise<Medicine>;
  deleteMedicine(args: Prisma.MedicineDeleteArgs): Promise<Medicine>;
  findMedicinesWithPagination(
    filters: { isActive?: boolean; search?: string },
    page?: number,
    limit?: number,
  ): Promise<[Medicine[], number]>;
  findMedicineDetail(id: string): Promise<Medicine | null>;
  findMedicineByCode(
    code: string,
    excludeId?: string,
  ): Promise<Medicine | null>;
  getMedicineStatistics(): Promise<{
    totalMedicines: number;
    activeMedicines: number;
    outOfStockMedicines: number;
  }>;
  createMedicinePlain(data: Prisma.MedicineCreateInput): Promise<Medicine>;
  updateMedicineById(
    id: string,
    data: Prisma.MedicineUpdateInput,
  ): Promise<Medicine>;

  transaction<T>(fn: (tx: TransactionClient) => Promise<T>): Promise<T>;

  // Custom methods to prevent Prisma leakage in BillingService
  findPendingLabOrdersForBilling(bookingId: string): Promise<LabOrder[]>;
  findPendingLabsForSync(bookingId: string): Promise<
    Prisma.LabOrderGetPayload<{
      include: { service: { select: { price: true } } };
    }>[]
  >;
  findPendingVsosForSync(bookingId: string): Promise<
    Prisma.VisitServiceOrderGetPayload<{
      include: { service: { select: { price: true; name: true } } };
    }>[]
  >;
  findPaidVsoPerformers(vsoIds: string[]): Promise<string[]>;

  // Custom methods to prevent Prisma leakage in MedicalRecordsService
  findMedicalRecordDetailByBookingId(
    bookingId: string,
    include?: Prisma.MedicalRecordInclude,
  ): Promise<MedicalRecordDetail | null>;
  saveSymptomsTransaction(
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
  ): Promise<MedicalRecordDetail>;
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
  >;
  orderServicesTransaction(
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
  }>;
  savePrescriptionTransaction(
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
  ): Promise<MedicalRecordDetail | null>;
  searchICD10(query: string): Promise<Icd10Code[]>;
  searchMedicines(query: string): Promise<Medicine[]>;
  findPatientHistory(
    patientProfileId: string,
    skip: number,
    limit: number,
  ): Promise<[PatientHistoryItem[], number]>;
  getPatientClinicalStats(
    patientProfileId: string,
    startOfYear: Date,
  ): Promise<{
    totalVisits: number;
    visitsThisYear: number;
    abnormalResults: number;
  }>;
  getDoctorClinicalStats(
    doctorId: string,
    startOfToday: Date,
  ): Promise<{ abnormalLabsToday: number; abnormalVsoToday: number }>;
  fulfillPrescriptionTransaction(
    prescriptionId: string,
    pharmacyInvoiceId?: string,
  ): Promise<Prescription>;
  startSpecialistExaminationTransaction(
    vsoId: string,
    bookingId: string | null,
    doctorId: string,
    prevBookingStatus?: string,
  ): Promise<VisitServiceOrder>;
  completeSpecialistExaminationTransaction(
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
  }>;
  checkAndAdvanceToResultsReadyTransaction(
    medicalRecordId: string,
    include?: Prisma.MedicalRecordInclude,
  ): Promise<{ advanced: boolean; record?: MedicalRecordDetail | null }>;
  findVisitServiceOrderById(id: string): Promise<VisitServiceOrder | null>;
  deleteVisitServiceOrderById(id: string): Promise<VisitServiceOrder>;
  countVisitServiceOrdersByMedicalRecordId(
    medicalRecordId: string,
  ): Promise<number>;
  saveDiagnosis(
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
  ): Promise<MedicalRecordDetail>;

  // Lab Orders business methods
  createLabOrderTransaction(
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
  ): Promise<LabOrder>;
  findLabOrdersByBookingId(bookingId: string): Promise<
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
  >;
  findPendingLabOrders(): Promise<
    Prisma.LabOrderGetPayload<{
      include: {
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
      };
    }>[]
  >;
  findLabOrderWithRelations(id: string): Promise<Prisma.LabOrderGetPayload<{
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
  }> | null>;
  findRecentCompletedLabOrders(
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
  >;
  findReadyToPerformLabOrders(
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
  >;
  getTechnicianStats(
    startOfDay: Date,
    endOfDay: Date,
  ): Promise<{ pending: number; inProgress: number; completedToday: number }>;
  findTechnicianHistoryPaginated(params: {
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
  >;
  uploadLabResultTransaction(
    labOrderId: string,
    resultAuthorId: string,
    dto: {
      resultText?: string;
      resultFileUrl?: string;
      isAbnormal?: boolean;
      abnormalNote?: string;
    },
  ): Promise<LabOrder>;
  updateLabOrderStatus(labOrderId: string, status: string): Promise<LabOrder>;
  findLabOrderForDeletion(id: string): Promise<Prisma.LabOrderGetPayload<{
    include: {
      invoiceItem: {
        include: {
          invoice: {
            select: { id: true; status: true };
          };
        };
      };
    };
  }> | null>;
  deleteLabOrderById(id: string): Promise<LabOrder>;

  // Visit Service Orders business methods
  findVisitServiceOrdersWorklist(
    status?: string,
  ): Promise<VisitServiceOrderWorklistItem[]>;
  startVisitServiceOrder(
    orderId: string,
    technicianId: string,
  ): Promise<VisitServiceOrder>;
  completeVisitServiceOrderTransaction(
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
  }>;
  findVisitServiceOrderDetailById(
    orderId: string,
  ): Promise<VisitServiceOrderDetail | null>;
  findDoctorSpecialistQueue(
    doctorId: string,
    startDate?: Date,
    endDate?: Date,
  ): Promise<DoctorSpecialistQueueItem[]>;

  // Analytics-oriented methods
  findMedicalRecordsForVisitTrend(filter: {
    patientProfileId: string;
    gte: Date;
  }): Promise<Array<{ createdAt: Date }>>;

  findDiagnosisRecords(filter: {
    patientProfileId?: string;
    doctorId?: string;
  }): Promise<
    Array<{ diagnosisCode: string | null; diagnosisName: string | null }>
  >;

  findMedicalRecordsForKPIs(filter: { doctorId: string; gte: Date }): Promise<
    Array<{
      patientProfileId: string;
      diagnosisCode: string | null;
      followUpDate: Date | null;
      labOrders: Array<{ id: string }>;
    }>
  >;
}
