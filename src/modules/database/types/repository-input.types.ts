import { BookingStatus, BookingSource, BookingPriority } from '@prisma/client';

export interface CreateOnlinePreBookingInput {
  patientProfileId: string;
  doctorId: string;
  serviceId?: string;
  bookingCode: string;
  bookingDate: Date;
  startTime: string;
  endTime: string;
  source: BookingSource;
  priority: BookingPriority;
  patientNotes?: string;
  createdById?: string | null;
  maxSlotsPerHour: number;
}

export interface CreateReceptionistBookingInput {
  patientProfileId: string;
  doctorId: string;
  serviceId?: string;
  bookingCode: string;
  bookingDate: Date;
  startTime?: string;
  endTime?: string;
  isPreBooked: boolean;
  source: BookingSource;
  priority: BookingPriority;
  patientNotes?: string;
  createdById: string;
  roomId?: string;
  maxSlotsPerHour: number;
}

export interface CreateDirectServiceBookingInput {
  patientProfileId: string;
  doctorId: string;
  bookingCode: string;
  bookingDate: Date;
  startTime?: string;
  endTime?: string;
  isPreBooked: boolean;
  priority: BookingPriority;
  patientNotes?: string;
  createdById: string;
  roomId?: string;
  maxSlotsPerHour: number;
  services: Array<{
    id: string;
    name: string;
    price: number;
    performerType: string;
  }>;
  serviceAssignments?: Array<{
    serviceId: string;
    performingDoctorId?: string | null;
  }>;
}

export interface AssignServiceAndMoveToConfirmedInput {
  bookingId: string;
  serviceId: string;
  doctorId: string;
  oldStatus: BookingStatus;
  changedById: string;
}
