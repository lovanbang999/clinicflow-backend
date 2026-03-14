import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AdminCreatePatientDto } from './dto/create-patient.dto';
import { AdminUpdatePatientDto } from './dto/update-patient.dto';
import { PatientSearchQueryDto } from './dto/patient-query.dto';
import { BookingStatus, Gender, Prisma, UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { MessageCodes } from 'src/common/constants/message-codes.const';
import { ApiException } from 'src/common/exceptions/api.exception';
import { ResponseHelper } from 'src/common/interfaces/api-response.interface';

@Injectable()
export class AdminPatientsService {
  constructor(private prisma: PrismaService) {}

  // Create
  async create(dto: AdminCreatePatientDto) {
    const {
      email,
      fullName,
      phone,
      gender,
      dateOfBirth,
      address,
      bloodType,
      ...profileData
    } = dto;

    const normalizedPhone = phone?.trim() || null;

    const queryOr: any[] = [{ email }];
    if (normalizedPhone) {
      queryOr.push({ phone: normalizedPhone });
    }

    const existingUser = await this.prisma.user.findFirst({
      where: {
        OR: queryOr,
      },
    });

    if (existingUser) {
      throw new ApiException(
        MessageCodes.PATIENT_EXISTS,
        'Email or phone number already exists',
        409,
        'Patient creation failed',
      );
    }

    const hashedPassword = await bcrypt.hash('Patient@123', 10);

    const result = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email,
          fullName,
          phone: normalizedPhone,
          gender,
          dateOfBirth: dateOfBirth?.trim() ? new Date(dateOfBirth) : null,
          address: address?.trim() || null,
          password: hashedPassword,
          role: UserRole.PATIENT,
          isActive: true,
          isVerified: true,
        },
      });

      const profile = await tx.patientProfile.create({
        data: {
          userId: user.id,
          bloodType: bloodType?.trim() || null,
          insuranceNumber: profileData.insuranceNumber?.trim() || null,
          insuranceProvider: profileData.insuranceProvider?.trim() || null,
          insuranceExpiry: profileData.insuranceExpiry?.trim()
            ? new Date(profileData.insuranceExpiry)
            : null,
          allergies: profileData.allergies?.trim() || null,
          chronicConditions: profileData.chronicConditions?.trim() || null,
          familyHistory: profileData.familyHistory?.trim() || null,
        },
      });

      return { ...user, profile };
    });

    return ResponseHelper.success(
      result,
      MessageCodes.PATIENT_CREATED,
      'Patient created successfully',
      201,
    );
  }

  // List / Search (GET /admin/patients)
  async findAll(query: PatientSearchQueryDto) {
    const { search, page = 1, limit = 10, gender, status, bloodType } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.UserWhereInput = {
      role: UserRole.PATIENT,
      deletedAt: null,
    };

    if (search) {
      where.OR = [
        { fullName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search, mode: 'insensitive' } },
        {
          patientProfile: {
            insuranceNumber: { contains: search, mode: 'insensitive' },
          },
        },
      ];
    }

    // Gender filter (comma-separated, e.g. 'MALE,FEMALE')
    if (gender) {
      const genders = gender.split(',').map((g) => g.trim() as Gender);
      where.gender = { in: genders };
    }

    // Status filter — maps 'active'/'inactive' to isActive boolean
    if (status) {
      const statuses = status.split(',').map((s) => s.trim());
      const hasActive = statuses.includes('active');
      const hasInactive = statuses.includes('inactive');
      if (hasActive && !hasInactive) {
        where.isActive = true;
      } else if (hasInactive && !hasActive) {
        where.isActive = false;
      }
    }

    // Blood type filter (comma-separated, e.g. 'A+,O+')
    if (bloodType) {
      const bloodTypes = bloodType.split(',').map((bt) => bt.trim());
      where.patientProfile = { bloodType: { in: bloodTypes } };
    }

    const [total, patients] = await Promise.all([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({
        where,
        select: {
          id: true,
          fullName: true,
          avatar: true,
          email: true,
          phone: true,
          gender: true,
          dateOfBirth: true,
          isActive: true,
          patientProfile: {
            select: { bloodType: true },
          },
        },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    // Enrich rows with last visit & next appointment from bookings
    const patientIds = patients.map((p) => p.id);
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    const [lastVisitRecords, nextApptRecords] =
      patientIds.length === 0
        ? [[], []]
        : await Promise.all([
            // Most recent completed visit per patient
            this.prisma.booking.findMany({
              where: {
                patientId: { in: patientIds },
                status: BookingStatus.COMPLETED,
              },
              orderBy: { bookingDate: 'desc' },
              distinct: ['patientId'],
              select: {
                patientId: true,
                bookingDate: true,
                doctor: { select: { fullName: true } },
              },
            }),
            // Nearest upcoming appointment per patient
            this.prisma.booking.findMany({
              where: {
                patientId: { in: patientIds },
                status: {
                  in: [
                    BookingStatus.PENDING,
                    BookingStatus.CONFIRMED,
                    BookingStatus.CHECKED_IN,
                  ],
                },
                bookingDate: { gte: today },
              },
              orderBy: { bookingDate: 'asc' },
              distinct: ['patientId'],
              select: {
                patientId: true,
                bookingDate: true,
                doctor: { select: { fullName: true } },
              },
            }),
          ]);

    const lastVisitMap = new Map(lastVisitRecords.map((b) => [b.patientId, b]));
    const nextApptMap = new Map(nextApptRecords.map((b) => [b.patientId, b]));

    const formatDate = (d: Date | null | undefined): string | null =>
      d ? d.toISOString().split('T')[0] : null;

    const rows = patients.map((p) => {
      const lv = lastVisitMap.get(p.id);
      const na = nextApptMap.get(p.id);
      return {
        id: p.id,
        fullName: p.fullName,
        avatar: p.avatar,
        email: p.email,
        phone: p.phone,
        gender: p.gender,
        dateOfBirth: formatDate(p.dateOfBirth),
        isActive: p.isActive,
        bloodType: p.patientProfile?.bloodType ?? null,
        lastVisit: formatDate(lv?.bookingDate),
        nextAppointment: formatDate(na?.bookingDate),
        assignedDoctor: na?.doctor?.fullName ?? lv?.doctor?.fullName ?? null,
      };
    });

    return ResponseHelper.success(
      {
        data: rows,
        meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
      },
      MessageCodes.PATIENT_LIST_RETRIEVED,
      'Patients retrieved successfully',
      200,
    );
  }

  async getStats() {
    const now = new Date();

    const startOfToday = new Date(now);
    startOfToday.setUTCHours(0, 0, 0, 0);
    const startOfTomorrow = new Date(startOfToday);
    startOfTomorrow.setUTCDate(startOfTomorrow.getUTCDate() + 1);

    const startOfSameLastWeek = new Date(startOfToday);
    startOfSameLastWeek.setUTCDate(startOfSameLastWeek.getUTCDate() - 7);
    const startOfDayAfterLastWeek = new Date(startOfSameLastWeek);
    startOfDayAfterLastWeek.setUTCDate(
      startOfDayAfterLastWeek.getUTCDate() + 1,
    );

    const startOfMonth = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
    );
    const startOfLastMonth = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1),
    );

    const notCancelledOrNoShow = {
      notIn: [BookingStatus.CANCELLED, BookingStatus.NO_SHOW],
    };
    const activeStatuses = {
      notIn: [
        BookingStatus.CANCELLED,
        BookingStatus.NO_SHOW,
        BookingStatus.COMPLETED,
        BookingStatus.QUEUED,
      ],
    };

    const [
      totalPatients,
      totalPatientsLastMonthEnd,
      newThisMonth,
      newLastMonth,
      patientsTodayCount,
      patientsLastWeekDayCount,
      activeAppointments,
      activeAppointmentsLastMonth,
    ] = await Promise.all([
      // KPI 1
      this.prisma.user.count({
        where: { role: UserRole.PATIENT, deletedAt: null },
      }),
      this.prisma.user.count({
        where: {
          role: UserRole.PATIENT,
          deletedAt: null,
          createdAt: { lt: startOfMonth },
        },
      }),

      // KPI 2
      this.prisma.user.count({
        where: {
          role: UserRole.PATIENT,
          deletedAt: null,
          createdAt: { gte: startOfMonth },
        },
      }),
      this.prisma.user.count({
        where: {
          role: UserRole.PATIENT,
          deletedAt: null,
          createdAt: { gte: startOfLastMonth, lt: startOfMonth },
        },
      }),

      // KPI 3 — unique patients with bookings today
      this.prisma.booking
        .findMany({
          where: {
            bookingDate: { gte: startOfToday, lt: startOfTomorrow },
            status: notCancelledOrNoShow,
          },
          distinct: ['patientId'],
          select: { patientId: true },
        })
        .then((r) => r.length),
      // KPI 3 trend — same day last week
      this.prisma.booking
        .findMany({
          where: {
            bookingDate: {
              gte: startOfSameLastWeek,
              lt: startOfDayAfterLastWeek,
            },
            status: notCancelledOrNoShow,
          },
          distinct: ['patientId'],
          select: { patientId: true },
        })
        .then((r) => r.length),

      // KPI 4 — active bookings this month
      this.prisma.booking.count({
        where: {
          bookingDate: { gte: startOfMonth },
          status: activeStatuses,
        },
      }),
      // KPI 4 trend — active bookings last month
      this.prisma.booking.count({
        where: {
          bookingDate: { gte: startOfLastMonth, lt: startOfMonth },
          status: activeStatuses,
        },
      }),
    ]);

    const trendPct = (current: number, prev: number): number | null =>
      prev === 0 ? null : Math.round(((current - prev) / prev) * 100);

    return ResponseHelper.success(
      {
        totalPatients,
        newThisMonth,
        patientsToday: patientsTodayCount,
        activeAppointments,
        totalPatientsTrend: trendPct(totalPatients, totalPatientsLastMonthEnd),
        newThisMonthTrend: trendPct(newThisMonth, newLastMonth),
        patientsTodayTrend: trendPct(
          patientsTodayCount,
          patientsLastWeekDayCount,
        ),
        activeAppointmentsTrend: trendPct(
          activeAppointments,
          activeAppointmentsLastMonth,
        ),
      },
      MessageCodes.PATIENT_STATS_RETRIEVED,
      'Patient statistics retrieved successfully',
      200,
    );
  }

  // Find one
  async findOne(id: string) {
    const patient = await this.findById(id);
    return ResponseHelper.success(
      patient,
      MessageCodes.PATIENT_RETRIEVED,
      'Patient details retrieved successfully',
      200,
    );
  }

  // Update
  async update(id: string, dto: AdminUpdatePatientDto) {
    await this.findById(id);

    const {
      email,
      fullName,
      phone,
      gender,
      dateOfBirth,
      address,
      bloodType,
      ...profileData
    } = dto;

    const result = await this.prisma.$transaction(async (tx) => {
      const updatedUser = await tx.user.update({
        where: { id },
        data: {
          email,
          fullName,
          phone: phone !== undefined ? phone?.trim() || null : undefined,
          gender,
          dateOfBirth:
            dateOfBirth !== undefined
              ? dateOfBirth?.trim()
                ? new Date(dateOfBirth)
                : null
              : undefined,
          address: address !== undefined ? address?.trim() || null : undefined,
        },
      });

      const profileDataToSave = {
        bloodType:
          bloodType !== undefined ? bloodType?.trim() || null : undefined,
        insuranceNumber:
          profileData.insuranceNumber !== undefined
            ? profileData.insuranceNumber?.trim() || null
            : undefined,
        insuranceProvider:
          profileData.insuranceProvider !== undefined
            ? profileData.insuranceProvider?.trim() || null
            : undefined,
        insuranceExpiry:
          profileData.insuranceExpiry !== undefined
            ? profileData.insuranceExpiry?.trim()
              ? new Date(profileData.insuranceExpiry)
              : null
            : undefined,
        allergies:
          profileData.allergies !== undefined
            ? profileData.allergies?.trim() || null
            : undefined,
        chronicConditions:
          profileData.chronicConditions !== undefined
            ? profileData.chronicConditions?.trim() || null
            : undefined,
        familyHistory:
          profileData.familyHistory !== undefined
            ? profileData.familyHistory?.trim() || null
            : undefined,
      };

      const updatedProfile = await tx.patientProfile.upsert({
        where: { userId: id },
        update: profileDataToSave,
        create: {
          userId: id,
          ...profileDataToSave,
        },
      });

      return { ...updatedUser, profile: updatedProfile };
    });

    return ResponseHelper.success(
      result,
      MessageCodes.PATIENT_UPDATED,
      'Patient updated successfully',
      200,
    );
  }

  // Health profile
  async getHealthProfile(id: string) {
    const patient = await this.prisma.user.findFirst({
      where: { id, role: UserRole.PATIENT, deletedAt: null },
      select: {
        id: true,
        fullName: true,
        patientProfile: {
          select: {
            allergies: true,
            chronicConditions: true,
            familyHistory: true,
            bloodType: true,
            heightCm: true,
            weightKg: true,
          },
        },
      },
    });

    if (!patient) {
      throw new ApiException(
        MessageCodes.PATIENT_NOT_FOUND,
        'Patient not found',
        404,
        'Health profile retrieval failed',
      );
    }

    return ResponseHelper.success(
      patient,
      MessageCodes.PATIENT_HEALTH_PROFILE_RETRIEVED,
      'Patient health profile retrieved successfully',
      200,
    );
  }

  // Internal helpers
  private async findById(id: string) {
    const patient = await this.prisma.user.findFirst({
      where: { id, role: UserRole.PATIENT, deletedAt: null },
      include: { patientProfile: true },
    });

    if (!patient) {
      throw new ApiException(
        MessageCodes.PATIENT_NOT_FOUND,
        'Patient not found',
        404,
        'Patient lookup failed',
      );
    }

    return patient;
  }
}
