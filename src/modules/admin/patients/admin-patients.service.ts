import { Inject, Injectable } from '@nestjs/common';
import { Prisma, Gender, UserRole } from '@prisma/client';
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
import { ApiException } from 'src/common/exceptions/api.exception';
import { MessageCodes } from 'src/common/constants/message-codes.const';
import * as bcrypt from 'bcrypt';

// Sequential counter helper — in production this should use DB sequence or redis
// Here we just count existing profiles to generate the next code
async function generatePatientCode(
  profileRepository: IProfileRepository,
): Promise<string> {
  const count = await profileRepository.countTotalPatients();
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
          gender: gender as Gender,
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
        } as Prisma.PatientProfileCreateInput,
      });

      return { profile };
    }

    // Check unique email / phone on User table
    const existingUser = await this.userRepository.findByEmailOrPhone(
      email,
      normalizedPhone,
    );

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
        gender: gender as Gender,
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
        gender: gender as Gender,
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

    return result;
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
      } as Prisma.PatientProfileCreateInput,
    });

    return profile;
  }

  // UPGRADE GUEST → registered patient
  async upgradeGuestToUser(
    patientProfileId: string,
    dto: { email: string; password?: string },
  ) {
    const profile =
      await this.profileRepository.findPatientProfileById(patientProfileId);

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
          gender: profile.gender as Gender,
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

    return result;
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

    const [profiles, total] =
      await this.profileRepository.findAdminPatientsPage(
        { search, gender, status, bloodType, patientCode, isGuest },
        page,
        limit,
      );

    // Enrich with last visit & next appointment
    const profileIds = profiles.map((p) => p.id);
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    const [lastVisitRecords, nextApptRecords] =
      await this.bookingRepository.findPatientLastAndNextBookings(
        profileIds,
        today,
      );

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

    return {
      data: rows,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async exportToExcel(query: PatientSearchQueryDto) {
    const { search, gender, status, bloodType, patientCode, isGuest } = query;

    const [profiles] = await this.profileRepository.findAdminPatientsPage(
      { search, gender, status, bloodType, patientCode, isGuest },
      1,
      100000, // retrieve all for export
    );

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

    const [patientStats, bookingStats] = await Promise.all([
      this.profileRepository.getPatientDashboardStats({
        startOfToday,
        startOfTomorrow,
        startOfSameLastWeek,
        startOfDayAfterLastWeek,
        startOfMonth,
        startOfLastMonth,
      }),
      this.bookingRepository.getBookingDashboardStats({
        startOfToday,
        startOfTomorrow,
        startOfSameLastWeek,
        startOfDayAfterLastWeek,
        startOfMonth,
        startOfLastMonth,
      }),
    ]);

    const {
      totalPatients,
      totalPatientsLastMonthEnd,
      newThisMonth,
      newLastMonth,
    } = patientStats;

    const {
      patientsTodayCount,
      patientsLastWeekDayCount,
      activeAppointments,
      activeAppointmentsLastMonth,
    } = bookingStats;

    const trendPct = (current: number, prev: number): number | null =>
      prev === 0 ? null : Math.round(((current - prev) / prev) * 100);

    return {
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
    };
  }

  // FIND ONE
  async findOne(id: string) {
    const patient = await this.findById(id);
    return patient;
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

    return updatedProfile;
  }

  // HEALTH PROFILE
  async getHealthProfile(id: string) {
    const profile = await this.profileRepository.findHealthProfile(id);

    if (!profile) {
      throw new ApiException(
        MessageCodes.PATIENT_NOT_FOUND,
        'Patient not found',
        404,
        'Health profile retrieval failed',
      );
    }

    return profile;
  }

  // INTERNAL HELPERS
  private async findById(id: string) {
    const profile = await this.profileRepository.findAdminPatientDetailById(id);

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
