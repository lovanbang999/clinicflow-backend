/**
 * Shared Prisma payload types for commonly-used booking queries with includes.
 * These allow services to use proper typing when accessing relations.
 */
import { Prisma } from '@prisma/client';

/** Booking with the standard include (patientProfile, doctor, service) */
export type BookingWithRelations = Prisma.BookingGetPayload<{
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
  };
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
          select: { fullName: true; phone: true; email: true };
        };
      };
    };
    invoiceItem: true;
    payments: true;
  };
}>;

/** Queue record with booking */
export type QueueRecordWithRelations = Prisma.BookingQueueGetPayload<{
  include: {
    booking: {
      include: {
        patientProfile: { select: { fullName: true; phone: true } };
        doctor: { select: { id: true; fullName: true } };
        service: { select: { name: true } };
      };
    };
  };
}>;

/** Lab order with booking and doctor info */
export type LabOrderWithRelations = Prisma.LabOrderGetPayload<{
  include: {
    booking: {
      select: { bookingCode: true; doctor: { select: { fullName: true } } };
    };
    patientProfile: { select: { fullName: true } };
  };
}>;

/** MedicalRecord with booking */
export type MedicalRecordWithBooking = Prisma.MedicalRecordGetPayload<{
  include: {
    booking: {
      include: {
        patientProfile: {
          select: { id: true; fullName: true; phone: true; email: true };
        };
        doctor: { select: { fullName: true } };
        service: { select: { name: true } };
      };
    };
  };
}>;
