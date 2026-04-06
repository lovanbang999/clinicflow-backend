import { Inject, Injectable } from '@nestjs/common';
import { Workbook } from 'exceljs';
import {
  IUserRepository,
  I_USER_REPOSITORY,
} from '../../database/interfaces/user.repository.interface';
import {
  IProfileRepository,
  I_PROFILE_REPOSITORY,
} from '../../database/interfaces/profile.repository.interface';
import {
  IBookingRepository,
  I_BOOKING_REPOSITORY,
} from '../../database/interfaces/booking.repository.interface';
import { AdminCreatePatientDto } from './dto/create-patient.dto';
import { AdminUpdatePatientDto } from './dto/update-patient.dto';
import { PatientSearchQueryDto } from './dto/patient-query.dto';
import { BookingStatus, Gender, Prisma, UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { MessageCodes } from 'src/common/constants/message-codes.const';
import { ApiException } from 'src/common/exceptions/api.exception';
import { ResponseHelper } from 'src/common/interfaces/api-response.interface';

// Sequential counter helper — in production this should use DB sequence or redis
// Here we just count existing profiles to generate the next code
async function generatePatientCode(
  profileRepository: IProfileRepository,
): Promise<string> {
  const count = await profileRepository.countPatientProfile({});
  return `BN-${new Date().getFullYear()}-${String(count + 1).padStart(4, '0')}`;
}

@Injectable()
export class AdminPatientsService {
  constructor(
    @Inject(I_PROFILE_REPOSITORY)
    private readonly profileRepository: IProfileRepository,
    @Inject(I_USER_REPOSITORY) private readonly userRepository: IUserRepository,
    @Inject(I_BOOKING_REPOSITORY)
    private readonly bookingRepository: IBookingRepository,
  ) {}

  // CREATE — registered patient (User + PatientProfile)
  async create(dto: AdminCreatePatientDto) {
    const {
      email,
      fullName,
      phone,
      gender,
      dateOfBirth,
      address,
      bloodType,
      createAppAccount,
      ...profileData
    } = dto;

    const normalizedPhone = phone?.trim() || null;

    if (!createAppAccount) {
      const patientCode = await generatePatientCode(this.profileRepository);
      const profile = await this.profileRepository.createPatientProfile({
        data: {
          userId: null,
          fullName,
          phone: normalizedPhone,
          email,
          dateOfBirth: dateOfBirth?.trim() ? new Date(dateOfBirth) : null,
          gender,
          address: address?.trim() || null,
          patientCode,
          isGuest: true,
          bloodType: bloodType?.trim() || null,
          nationalId: profileData.nationalId?.trim() || null,
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

      return ResponseHelper.success(
        { profile },
        MessageCodes.PATIENT_CREATED,
        'Guest patient profile created successfully',
        201,
      );
    }

    // Check unique email / phone on User table
    const queryOr: any[] = [{ email }];
    if (normalizedPhone) {
      queryOr.push({ phone: normalizedPhone });
    }

    const existingUser = await this.userRepository.findFirst({
      where: { OR: queryOr },
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
    const patientCode = await generatePatientCode(this.profileRepository);

    const userCreateResult = await this.userRepository.createRegisteredPatient(
      {
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
      {
        fullName,
        phone: normalizedPhone,
        email,
        dateOfBirth: dateOfBirth?.trim() ? new Date(dateOfBirth) : null,
        gender,
        address: address?.trim() || null,
        patientCode,
        isGuest: false,
        bloodType: bloodType?.trim() || null,
        nationalId: profileData.nationalId?.trim() || null,
        insuranceNumber: profileData.insuranceNumber?.trim() || null,
        insuranceProvider: profileData.insuranceProvider?.trim() || null,
        insuranceExpiry: profileData.insuranceExpiry?.trim()
          ? new Date(profileData.insuranceExpiry)
          : null,
        allergies: profileData.allergies?.trim() || null,
        chronicConditions: profileData.chronicConditions?.trim() || null,
        familyHistory: profileData.familyHistory?.trim() || null,
      },
    );

    const result = {
      ...userCreateResult,
      profile: userCreateResult.patientProfile,
    };

    return ResponseHelper.success(
      result,
      MessageCodes.PATIENT_CREATED,
      'Patient created successfully',
      201,
    );
  }

  // CREATE GUEST — walk-in patient (PatientProfile only, no User)
  async createGuest(dto: {
    fullName: string;
    phone?: string;
    email?: string;
    gender?: Gender;
    dateOfBirth?: string;
    address?: string;
    bloodType?: string;
  }) {
    const patientCode = await generatePatientCode(this.profileRepository);
    const profile = await this.profileRepository.createPatientProfile({
      data: {
        userId: null,
        fullName: dto.fullName,
        phone: dto.phone?.trim() || null,
        email: dto.email?.trim() || null,
        dateOfBirth: dto.dateOfBirth?.trim() ? new Date(dto.dateOfBirth) : null,
        gender: dto.gender,
        address: dto.address?.trim() || null,
        patientCode,
        isGuest: true,
        bloodType: dto.bloodType?.trim() || null,
      },
    });

    return ResponseHelper.success(
      profile,
      MessageCodes.PATIENT_CREATED,
      'Guest patient created successfully',
      201,
    );
  }

  // UPGRADE GUEST → registered patient
  async upgradeGuestToUser(
    patientProfileId: string,
    dto: { email: string; password?: string },
  ) {
    const profile = await this.profileRepository.findUniquePatientProfile({
      where: { id: patientProfileId },
    });

    if (!profile) {
      throw new ApiException(
        MessageCodes.PATIENT_NOT_FOUND,
        'Patient profile not found',
        404,
        'Upgrade failed',
      );
    }

    if (!profile.isGuest) {
      throw new ApiException(
        MessageCodes.PATIENT_EXISTS,
        'Patient already has an account',
        409,
        'Upgrade failed',
      );
    }

    const hashedPassword = await bcrypt.hash(dto.password || 'Patient@123', 10);

    const userCreateResult =
      await this.userRepository.createGuestAsUserTransaction(
        patientProfileId,
        {
          email: dto.email,
          fullName: profile.fullName,
          phone: profile.phone,
          gender: profile.gender,
          dateOfBirth: profile.dateOfBirth,
          address: profile.address,
          password: hashedPassword,
          role: UserRole.PATIENT,
          isActive: true,
          isVerified: false,
        },
        {
          email: dto.email,
          isGuest: false,
        },
      );

    const result = {
      user: userCreateResult,
      profile: { ...profile, ...userCreateResult.patientProfile },
    };

    return ResponseHelper.success(
      result,
      MessageCodes.PATIENT_UPDATED,
      'Guest patient upgraded to registered account successfully',
      200,
    );
  }

  // LIST / SEARCH — query on PatientProfile (includes both registered + guests)
  async findAll(query: PatientSearchQueryDto) {
    const {
      search,
      page = 1,
      limit = 10,
      gender,
      status,
      bloodType,
      patientCode,
      isGuest,
    } = query;
    const skip = (page - 1) * limit;

    // Build PatientProfile where clause
    const where: Prisma.PatientProfileWhereInput = {};

    if (isGuest !== undefined) {
      where.isGuest = isGuest;
    }

    if (patientCode) {
      where.patientCode = { contains: patientCode, mode: 'insensitive' };
    }

    if (search) {
      where.OR = [
        { fullName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search, mode: 'insensitive' } },
        { patientCode: { contains: search, mode: 'insensitive' } },
        { insuranceNumber: { contains: search, mode: 'insensitive' } },
        { nationalId: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (gender) {
      const genders = gender.split(',').map((g) => g.trim() as Gender);
      where.gender = { in: genders };
    }

    if (bloodType) {
      const bloodTypes = bloodType.split(',').map((bt) => bt.trim());
      where.bloodType = { in: bloodTypes };
    }

    // Status filter — only applies to registered patients (who have User records)
    if (status) {
      const statuses = status.split(',').map((s) => s.trim());
      const hasActive = statuses.includes('active');
      const hasInactive = statuses.includes('inactive');
      if (hasActive && !hasInactive) {
        where.user = { isActive: true };
      } else if (hasInactive && !hasActive) {
        where.user = { isActive: false };
      }
    }

    const [total, profiles] = await Promise.all([
      this.profileRepository.countPatientProfile({ where }),
      this.profileRepository.findManyPatientProfile({
        where,
        select: {
          id: true,
          fullName: true,
          email: true,
          phone: true,
          gender: true,
          dateOfBirth: true,
          patientCode: true,
          isGuest: true,
          bloodType: true,
          userId: true,
          user: {
            select: {
              id: true,
              avatar: true,
              isActive: true,
            },
          },
        },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    // Enrich with last visit & next appointment
    const profileIds = profiles.map((p) => p.id);
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    const [lastVisitRecords, nextApptRecords] =
      profileIds.length === 0
        ? [[], []]
        : await Promise.all([
            this.bookingRepository.findManyBooking({
              where: {
                patientProfileId: { in: profileIds },
                status: BookingStatus.COMPLETED,
              },
              orderBy: { bookingDate: 'desc' },
              distinct: ['patientProfileId'],
              select: {
                patientProfileId: true,
                bookingDate: true,
                doctor: { select: { fullName: true } },
              },
            }),
            this.bookingRepository.findManyBooking({
              where: {
                patientProfileId: { in: profileIds },
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
              distinct: ['patientProfileId'],
              select: {
                patientProfileId: true,
                bookingDate: true,
                doctor: { select: { fullName: true } },
              },
            }),
          ]);

    const lastVisitMap = new Map(
      lastVisitRecords.map((b) => [b.patientProfileId, b]),
    );
    const nextApptMap = new Map(
      nextApptRecords.map((b) => [b.patientProfileId, b]),
    );

    const formatDate = (d: Date | null | undefined): string | null =>
      d ? d.toISOString().split('T')[0] : null;

    const rows = profiles.map((p) => {
      const lv = lastVisitMap.get(p.id);
      const na = nextApptMap.get(p.id);
      return {
        id: p.id,
        userId: p.userId,
        fullName: p.fullName,
        avatar: p.user?.avatar ?? null,
        email: p.email,
        phone: p.phone,
        gender: p.gender,
        dateOfBirth: formatDate(p.dateOfBirth),
        isActive: p.user?.isActive ?? null, // null for guests
        isGuest: p.isGuest,
        patientCode: p.patientCode,
        bloodType: p.bloodType ?? null,
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

  async exportToExcel(query: PatientSearchQueryDto) {
    const { search, gender, status, bloodType, patientCode, isGuest } = query;

    // Build PatientProfile where clause
    const where: Prisma.PatientProfileWhereInput = {};

    if (isGuest !== undefined) {
      where.isGuest = isGuest;
    }

    if (patientCode) {
      where.patientCode = { contains: patientCode, mode: 'insensitive' };
    }

    if (search) {
      where.OR = [
        { fullName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search, mode: 'insensitive' } },
        { patientCode: { contains: search, mode: 'insensitive' } },
        { insuranceNumber: { contains: search, mode: 'insensitive' } },
        { nationalId: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (gender) {
      const genders = gender.split(',').map((g) => g.trim() as Gender);
      where.gender = { in: genders };
    }

    if (bloodType) {
      const bloodTypes = bloodType.split(',').map((bt) => bt.trim());
      where.bloodType = { in: bloodTypes };
    }

    if (status) {
      const statuses = status.split(',').map((s) => s.trim());
      const hasActive = statuses.includes('active');
      const hasInactive = statuses.includes('inactive');
      if (hasActive && !hasInactive) {
        where.user = { isActive: true };
      } else if (hasInactive && !hasActive) {
        where.user = { isActive: false };
      }
    }

    const profiles = await this.profileRepository.findManyPatientProfile({
      where,
      include: {
        user: {
          select: {
            isActive: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const workbook = new Workbook();
    const worksheet = workbook.addWorksheet('Patients');

    worksheet.columns = [
      { header: 'Patient Code', key: 'patientCode', width: 15 },
      { header: 'Full Name', key: 'fullName', width: 25 },
      { header: 'Email', key: 'email', width: 25 },
      { header: 'Phone', key: 'phone', width: 15 },
      { header: 'Gender', key: 'gender', width: 10 },
      { header: 'Date of Birth', key: 'dateOfBirth', width: 15 },
      { header: 'Status', key: 'status', width: 10 },
      { header: 'Blood Type', key: 'bloodType', width: 10 },
      { header: 'Type', key: 'type', width: 10 },
      { header: 'National ID', key: 'nationalId', width: 15 },
      { header: 'Insurance Number', key: 'insuranceNumber', width: 20 },
    ];

    const formatDate = (d: Date | null | undefined): string =>
      d ? d.toISOString().split('T')[0] : '';

    profiles.forEach((p) => {
      worksheet.addRow({
        patientCode: p.patientCode,
        fullName: p.fullName,
        email: p.email ?? '',
        phone: p.phone ?? '',
        gender: p.gender ?? '',
        dateOfBirth: formatDate(p.dateOfBirth),
        status: p.isGuest ? 'Guest' : p.user?.isActive ? 'Active' : 'Inactive',
        bloodType: p.bloodType ?? '',
        type: p.isGuest ? 'Guest' : 'Registered',
        nationalId: p.nationalId ?? '',
        insuranceNumber: p.insuranceNumber ?? '',
      });
    });

    // Styling
    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E0E0' },
    };

    return workbook.xlsx.writeBuffer();
  }

  // STATS (counts PatientProfile, including guests)
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
      // KPI 1 — total patient profiles (registered + guest)
      this.profileRepository.countPatientProfile({}),
      this.profileRepository.countPatientProfile({
        where: { createdAt: { lt: startOfMonth } },
      }),
      // KPI 2 — new profiles this month
      this.profileRepository.countPatientProfile({
        where: { createdAt: { gte: startOfMonth } },
      }),
      this.profileRepository.countPatientProfile({
        where: { createdAt: { gte: startOfLastMonth, lt: startOfMonth } },
      }),
      // KPI 3 — unique profiles with bookings today
      this.bookingRepository
        .findManyBooking({
          where: {
            bookingDate: { gte: startOfToday, lt: startOfTomorrow },
            status: notCancelledOrNoShow,
          },
          distinct: ['patientProfileId'],
          select: { patientProfileId: true },
        })
        .then((r: any[]) => r.length),
      this.bookingRepository
        .findManyBooking({
          where: {
            bookingDate: {
              gte: startOfSameLastWeek,
              lt: startOfDayAfterLastWeek,
            },
            status: notCancelledOrNoShow,
          },
          distinct: ['patientProfileId'],
          select: { patientProfileId: true },
        })
        .then((r: any[]) => r.length),
      // KPI 4 — active bookings this month
      this.bookingRepository.countBooking({
        where: {
          bookingDate: { gte: startOfMonth },
          status: activeStatuses,
        },
      }),
      this.bookingRepository.countBooking({
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

  // FIND ONE
  async findOne(id: string) {
    const patient = await this.findById(id);
    return ResponseHelper.success(
      patient,
      MessageCodes.PATIENT_RETRIEVED,
      'Patient details retrieved successfully',
      200,
    );
  }

  // UPDATE
  async update(id: string, dto: AdminUpdatePatientDto) {
    const existingProfile = await this.findById(id);

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

    const profileUpdateData: Prisma.PatientProfileUpdateInput = {
      fullName:
        fullName !== undefined ? fullName?.trim() || undefined : undefined,
      phone: phone !== undefined ? phone?.trim() || null : undefined,
      email: email !== undefined ? email?.trim() || null : undefined,
      gender,
      dateOfBirth:
        dateOfBirth !== undefined
          ? dateOfBirth?.trim()
            ? new Date(dateOfBirth)
            : null
          : undefined,
      address: address !== undefined ? address?.trim() || null : undefined,
      bloodType:
        bloodType !== undefined ? bloodType?.trim() || null : undefined,
      nationalId:
        profileData.nationalId !== undefined
          ? profileData.nationalId?.trim() || null
          : undefined,
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

    let userDataToUpdate: Prisma.UserUpdateInput | undefined = undefined;
    if (existingProfile.userId) {
      userDataToUpdate = {
        email: email !== undefined ? email : undefined,
        fullName:
          fullName !== undefined ? fullName?.trim() || undefined : undefined,
        phone: phone !== undefined ? phone?.trim() || null : undefined,
        gender,
        dateOfBirth:
          dateOfBirth !== undefined
            ? dateOfBirth?.trim()
              ? new Date(dateOfBirth)
              : null
            : undefined,
        address: address !== undefined ? address?.trim() || null : undefined,
      };
    }

    const updatedProfile =
      await this.profileRepository.updatePatientProfileTransaction(
        id,
        profileUpdateData,
        userDataToUpdate,
      );

    return ResponseHelper.success(
      updatedProfile,
      MessageCodes.PATIENT_UPDATED,
      'Patient updated successfully',
      200,
    );
  }

  // HEALTH PROFILE
  async getHealthProfile(id: string) {
    const profile = await this.profileRepository.findUniquePatientProfile({
      where: { id },
      select: {
        id: true,
        fullName: true,
        patientCode: true,
        isGuest: true,
        allergies: true,
        chronicConditions: true,
        familyHistory: true,
        bloodType: true,
        heightCm: true,
        weightKg: true,
        occupation: true,
        ethnicity: true,
      },
    });

    if (!profile) {
      throw new ApiException(
        MessageCodes.PATIENT_NOT_FOUND,
        'Patient not found',
        404,
        'Health profile retrieval failed',
      );
    }

    return ResponseHelper.success(
      profile,
      MessageCodes.PATIENT_HEALTH_PROFILE_RETRIEVED,
      'Patient health profile retrieved successfully',
      200,
    );
  }

  // INTERNAL HELPERS
  private async findById(id: string) {
    const profile = await this.profileRepository.findUniquePatientProfile({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            isActive: true,
            isVerified: true,
            avatar: true,
            role: true,
          },
        },
      },
    });

    if (!profile) {
      throw new ApiException(
        MessageCodes.PATIENT_NOT_FOUND,
        'Patient not found',
        404,
        'Patient lookup failed',
      );
    }

    return profile;
  }
}
