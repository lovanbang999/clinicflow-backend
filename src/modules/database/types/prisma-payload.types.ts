/**
 * Shared Prisma payload types for commonly-used booking queries with includes.
 * These allow services to use proper typing when accessing relations.
 */
import { Prisma } from '@prisma/client';

/** Standard select for PatientProfile in booking relations */
export const PatientProfileSelect = {
  select: {
    id: true,
    userId: true,
    fullName: true,
    phone: true,
    email: true,
    isGuest: true,
    patientCode: true,
  },
} as const;

/** Standard select for Doctor in booking relations */
export const DoctorSelect = {
  select: {
    id: true,
    email: true,
    fullName: true,
  },
} as const;

/** Standard select for Service in booking relations */
export const ServiceSelect = {
  select: {
    id: true,
    name: true,
    durationMinutes: true,
    price: true,
    maxSlotsPerHour: true,
  },
} as const;

/** Standard include for Bookings with relations */
export const BookingInclude = {
  patientProfile: PatientProfileSelect,
  doctor: DoctorSelect,
  service: ServiceSelect,
  room: true,
  invoices: {
    select: {
      id: true,
      status: true,
      invoiceType: true,
      totalAmount: true,
    },
  },
} as const;

/** Booking with the standard include (patientProfile, doctor, service) */
export type BookingWithRelations = Prisma.BookingGetPayload<{
  include: typeof BookingInclude;
}>;

/** Booking with duration only (used in scheduling checks) */
export type BookingWithDuration = Prisma.BookingGetPayload<{
  include: { service: { select: { durationMinutes: true } } };
}>;

/** Full booking detail (findBookingById) */
export type BookingDetail = Prisma.BookingGetPayload<{
  include: {
    patientProfile: {
      select: {
        id: true;
        userId: true;
        fullName: true;
        phone: true;
        email: true;
        isGuest: true;
        patientCode: true;
      };
    };
    doctor: { select: { id: true; email: true; fullName: true } };
    service: {
      select: {
        id: true;
        name: true;
        durationMinutes: true;
        price: true;
      };
    };
    room: true;
    queueRecord: true;
    statusHistory: {
      include: {
        changedBy: { select: { id: true; fullName: true; role: true } };
      };
    };
    medicalRecord: {
      include: {
        prescription: { include: { items: true } };
        labOrders: true;
      };
    };
  };
}>;

/** Invoice with booking relation */
export type InvoiceWithBooking = Prisma.InvoiceGetPayload<{
  include: {
    booking: {
      select: {
        id: true;
        bookingCode: true;
        bookingDate: true;
        patientProfile: {
          select: {
            fullName: true;
            phone: true;
            email: true;
            patientCode: true;
          };
        };
      };
    };
    items: true;
    payments: true;
  };
}>;

/** Queue record with booking */
export type QueueRecordWithRelations = Prisma.BookingQueueGetPayload<{
  include: {
    booking: {
      include: typeof BookingInclude;
    };
  };
}>;

/** Include for LabOrder with invoice relations - used in deletion guard */
export const LabOrderDeleteInclude = {
  invoiceItem: {
    select: {
      id: true,
      invoiceId: true,
      invoice: {
        select: { status: true },
      },
    },
  },
} as const;

/** LabOrder with invoice relations */
export type LabOrderWithInvoice = Prisma.LabOrderGetPayload<{
  include: typeof LabOrderDeleteInclude;
}>;

/** Lab order with booking and doctor info */
export type LabOrderWithRelations = Prisma.LabOrderGetPayload<{
  include: {
    booking: {
      select: {
        bookingCode: true;
        doctor: { select: { fullName: true } };
      };
    };
    patientProfile: { select: { fullName: true } };
  };
}>;

/** MedicalRecord with booking */
export type MedicalRecordWithBooking = Prisma.MedicalRecordGetPayload<{
  include: {
    booking: {
      include: typeof BookingInclude;
    };
  };
}>;

/** Temporary slot reservation (soft-lock) */
export interface SlotReservation {
  id: string;
  doctorId: string;
  bookingDate: Date;
  startTime: string;
  patientProfileId: string;
  expiresAt: Date;
  createdAt: Date;
}

export type ConfirmedBookingReminder = Prisma.BookingGetPayload<{
  include: {
    patientProfile: {
      select: {
        id: true;
        userId: true;
        fullName: true;
        user: { select: { email: true } };
      };
    };
    doctor: true;
    service: true;
  };
}>;

export type PendingOffDayWithDoctor = Prisma.DoctorOffDayGetPayload<{
  include: {
    doctor: {
      select: {
        id: true;
        fullName: true;
        email: true;
      };
    };
  };
}>;

export type BookingForQueue = Prisma.BookingGetPayload<{
  include: {
    service: true;
    patientProfile: true;
  };
}>;

export type QueueRecordDetail = Prisma.BookingQueueGetPayload<{
  include: {
    booking: {
      include: typeof BookingInclude & {
        medicalRecord: {
          select: {
            id: true;
            isFinalized: true;
            chiefComplaint: true;
            clinicalFindings: true;
            diagnosisCode: true;
            diagnosisName: true;
            treatmentPlan: true;
            doctorNotes: true;
            followUpDate: true;
            followUpNote: true;
          };
        };
      };
    };
  };
}>;

export type ActiveWalkInQueueForRecalculation = Prisma.BookingQueueGetPayload<{
  include: {
    booking: {
      select: {
        id: true;
        service: { select: { durationMinutes: true } };
      };
    };
  };
}>;

export type FirstInQueueDetail = Prisma.BookingQueueGetPayload<{
  include: {
    booking: {
      include: {
        service: true;
      };
    };
  };
}>;

export type DoctorSpecialistQueueItem = Prisma.VisitServiceOrderGetPayload<{
  include: {
    service: { select: { id: true; name: true } };
    medicalRecord: {
      include: {
        booking: {
          include: {
            patientProfile: true;
            doctor: true;
            service: true;
            medicalRecord: {
              select: {
                id: true;
                isFinalized: true;
                chiefComplaint: true;
                clinicalFindings: true;
                diagnosisCode: true;
                diagnosisName: true;
                treatmentPlan: true;
                doctorNotes: true;
                followUpDate: true;
                followUpNote: true;
              };
            };
          };
        };
      };
    };
  };
}>;

export type MedicalRecordDetail = Prisma.MedicalRecordGetPayload<{
  include: {
    visitServiceOrders: {
      include: { service: true; performer: true };
    };
    labOrders: {
      include: { result: true; service: true };
    };
    prescription: {
      include: { items: true };
    };
    booking: {
      include: {
        doctor: true;
        patientProfile: true;
      };
    };
  };
}>;

export type PatientHistoryItem = Prisma.MedicalRecordGetPayload<{
  include: {
    booking: {
      include: {
        doctor: { select: { id: true; fullName: true } };
        service: { select: { id: true; name: true } };
      };
    };
    visitServiceOrders: { include: { service: true } };
    labOrders: { include: { service: true } };
    prescription: {
      include: { items: true };
    };
  };
}>;

export type AdvancedMedicalRecordWithBooking = Prisma.MedicalRecordGetPayload<{
  include: {
    booking: {
      include: { patientProfile: true };
    };
  };
}>;

export type UserWithProfile = Prisma.UserGetPayload<{
  select: {
    id: true;
    email: true;
    fullName: true;
    phone: true;
    role: true;
    avatar: true;
    isActive: true;
    createdAt: true;
    updatedAt: true;
    patientProfile: {
      select: { id: true; patientCode: true };
    };
  };
}>;

export type VisitServiceOrderWorklistItem = Prisma.VisitServiceOrderGetPayload<{
  include: {
    service: {
      select: { id: true; name: true; category: true; serviceCode: true };
    };
    medicalRecord: {
      include: {
        booking: {
          include: {
            patientProfile: {
              select: {
                id: true;
                patientCode: true;
                fullName: true;
                phone: true;
                gender: true;
                dateOfBirth: true;
              };
            };
            doctor: { select: { id: true; fullName: true } };
          };
        };
      };
    };
  };
}>;

export type VisitServiceOrderDetail = Prisma.VisitServiceOrderGetPayload<{
  include: {
    service: true;
    medicalRecord: {
      include: {
        booking: {
          include: {
            patientProfile: true;
            doctor: { select: { id: true; fullName: true } };
          };
        };
      };
    };
  };
}>;

export type TechnicianSpecializationDetail =
  Prisma.TechnicianSpecializationGetPayload<{
    include: { category: { select: { id: true; name: true; code: true } } };
  }>;

export type ServiceWithFiltersResult = Prisma.ServiceGetPayload<{
  include: {
    category: true;
    doctorServices: {
      include: {
        doctorProfile: {
          include: { user: { select: { id: true; fullName: true } } };
        };
      };
    };
  };
}>;

export type ServiceDetailResult = Prisma.ServiceGetPayload<{
  include: {
    category: true;
    doctorServices: {
      include: {
        doctorProfile: {
          include: {
            user: {
              select: {
                id: true;
                fullName: true;
                avatar: true;
                email: true;
              };
            };
          };
        };
      };
    };
  };
}>;

export type InvoiceDetailResult = Prisma.InvoiceGetPayload<{
  include: {
    items: {
      include: {
        labOrder: {
          include: {
            service: {
              include: { category: true };
            };
          };
        };
        visitServiceOrder: {
          include: {
            performer: true;
            service: {
              include: { category: true };
            };
          };
        };
      };
    };
    payments: true;
    booking: {
      include: {
        doctor: { select: { id: true; fullName: true } };
        patientProfile: {
          select: {
            id: true;
            fullName: true;
            patientCode: true;
            phone: true;
          };
        };
        service: { select: { id: true; name: true } };
        medicalRecord: true;
      };
    };
  };
}>;

export type InvoiceDetailForPaymentResult = Prisma.InvoiceGetPayload<{
  include: {
    payments: true;
    booking: {
      include: {
        patientProfile: { select: { fullName: true; userId: true } };
        medicalRecord: true;
      };
    };
  };
}>;

export type InvoiceDetailPostPaymentResult = Prisma.InvoiceGetPayload<{
  include: {
    items: {
      include: {
        labOrder: true;
        visitServiceOrder: {
          include: { performer: true; service: true };
        };
      };
    };
    payments: true;
    booking: {
      include: {
        patientProfile: {
          select: {
            id: true;
            userId: true;
            fullName: true;
            user: { select: { email: true } };
          };
        };
      };
    };
  };
}>;

export type InvoiceDetailForFinalizeResult = Prisma.InvoiceGetPayload<{
  include: {
    items: {
      include: {
        labOrder: true;
      };
    };
    payments: true;
    booking: {
      include: {
        patientProfile: true;
        doctor: true;
        room: true;
      };
    };
  };
}>;
