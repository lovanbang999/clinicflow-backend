import {
  IUserRepository,
  I_USER_REPOSITORY,
  PublicDoctorResult,
} from '../database/interfaces/user.repository.interface';
import {
  IProfileRepository,
  I_PROFILE_REPOSITORY,
} from '../database/interfaces/profile.repository.interface';
import {
  IBookingRepository,
  I_BOOKING_REPOSITORY,
} from '../database/interfaces/booking.repository.interface';
import {
  RegisterPatientDto,
  CreateGuestPatientDto,
} from './dto/quick-create-patient.dto';
import { Injectable, Inject, Logger } from '@nestjs/common';
import { SequenceService } from '../database/services/sequence.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { FilterUserDto } from './dto/filter-user.dto';
import { FilterPatientDto } from './dto/filter-patient.dto';
import { UpdatePatientProfileDto } from './dto/update-patient-profile.dto';
import { Prisma, UserRole, Gender } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { MessageCodes } from '../../common/constants/message-codes.const';
import { ApiException } from '../../common/exceptions/api.exception';
import { RedisService } from '../database/services/redis.service';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    @Inject(I_USER_REPOSITORY) private readonly userRepository: IUserRepository,
    @Inject(I_PROFILE_REPOSITORY)
    private readonly profileRepository: IProfileRepository,
    @Inject(I_BOOKING_REPOSITORY)
    private readonly bookingRepository: IBookingRepository,
    private readonly sequenceService: SequenceService,
    private readonly redisService: RedisService,
  ) {}

  private async clearPublicDoctorsCache() {
    try {
      if (this.redisService.isReady()) {
        await this.redisService.delPattern('cache:doctors:public:*');
      }
    } catch (error) {
      this.logger.error(
        'Failed to clear public doctors cache:',
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  /**
   * Create a new user (ADMIN only)
   */
  async create(createUserDto: CreateUserDto) {
    const {
      email,
      password,
      fullName,
      phone,
      role,
      specialties,
      qualifications,
      bio,
      yearsOfExperience,
      consultationFee,
    } = createUserDto;

    // Check if email exists
    const existingUser = await this.userRepository.findByEmail(email);

    if (existingUser) {
      throw new ApiException(
        MessageCodes.USER_EMAIL_EXISTS,
        'Email already exists',
        409,
        'User creation failed',
      );
    }

    // Check if phone exists (if provided)
    if (phone) {
      const existingPhone = await this.userRepository.findByPhone(phone);

      if (existingPhone) {
        throw new ApiException(
          MessageCodes.USER_PHONE_EXISTS,
          'Phone number already exists',
          409,
          'User creation failed',
        );
      }
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user (admin-created users are auto-active)
    const userData: Prisma.UserCreateInput = {
      email,
      password: hashedPassword,
      fullName,
      phone,
      role,
      isActive: true,
    };

    // Auto-create DoctorProfile if role is DOCTOR
    let doctorProfileData:
      | Prisma.DoctorProfileCreateWithoutUserInput
      | undefined = undefined;
    if (role === UserRole.DOCTOR) {
      doctorProfileData = {
        specialties: specialties || [],
        qualifications: qualifications || [],
        bio: bio || null,
        yearsOfExperience: yearsOfExperience || 0,
        consultationFee: consultationFee || null,
      };
    }

    const user = await this.userRepository.createAdminUser(
      userData,
      doctorProfileData,
    );

    this.logger.log(
      `Successfully created user ${user.id} with role ${role} by Admin`,
    );

    return user;
  }

  /**
   * Internal helper to generate a unique patient code (BN-YYYY-NNNN)
   */
  private async generatePatientCode(): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `BN-${year}-`;
    const count = await this.sequenceService.generateNextSequence(prefix);
    return `${prefix}${String(count).padStart(4, '0')}`;
  }

  /**
   * Create or find a patient with a system account
   */
  async registerPatient(dto: RegisterPatientDto) {
    const {
      fullName,
      phone,
      email,
      dateOfBirth,
      gender,
      address,
      nationalId,
      bloodType,
    } = dto;

    // 1. Check if User with this phone or email exists
    const existingUser = await this.userRepository.findByPhoneOrEmail(
      phone,
      email,
    );

    if (existingUser) {
      return existingUser;
    }

    // 2. Check if Guest PatientProfile with this phone exists
    const existingGuest =
      await this.profileRepository.findGuestPatientByPhone(phone);

    if (existingGuest) {
      // Upgrade Guest to User
      const hashedPassword = await bcrypt.hash(phone, 10);

      const userData = {
        email,
        password: hashedPassword,
        fullName,
        phone,
        role: UserRole.PATIENT,
        isActive: true,
        isVerified: true,
        ...(dateOfBirth && { dateOfBirth: new Date(dateOfBirth) }),
        ...(gender && { gender }),
        ...(address && { address }),
      };

      const profileData = {
        fullName,
        ...(dateOfBirth && { dateOfBirth: new Date(dateOfBirth) }),
        ...(gender && { gender }),
        ...(address && { address }),
        ...(nationalId && { nationalId }),
        ...(bloodType && { bloodType }),
      };

      const upgradedUserWithProfile =
        await this.userRepository.createGuestAsUserTransaction(
          existingGuest.id,
          userData,
          profileData,
        );

      this.logger.log(
        `Successfully upgraded guest patient profile ${existingGuest.id} to user account ${upgradedUserWithProfile.id}`,
      );

      return upgradedUserWithProfile;
    }

    // 3. Create fresh User and PatientProfile
    const hashedPassword = await bcrypt.hash(phone, 10);
    const patientCode = await this.generatePatientCode();

    const userData = {
      email,
      password: hashedPassword,
      fullName,
      phone,
      role: UserRole.PATIENT,
      isActive: true,
      isVerified: true,
      ...(dateOfBirth && { dateOfBirth: new Date(dateOfBirth) }),
      ...(gender && { gender }),
      ...(address && { address }),
    };

    const profileData = {
      patientCode,
      fullName,
      phone,
      email,
      ...(dateOfBirth && { dateOfBirth: new Date(dateOfBirth) }),
      ...(gender && { gender }),
      ...(address && { address }),
      ...(nationalId && { nationalId }),
      ...(bloodType && { bloodType }),
      isGuest: false,
    };

    const result = await this.userRepository.createRegisteredPatient(
      userData,
      profileData,
    );

    this.logger.log(
      `Successfully registered new patient ${result.id} with patient code ${patientCode}`,
    );

    return result;
  }

  /**
   * Create or find a guest patient (profile only)
   */
  async createGuestPatient(dto: CreateGuestPatientDto) {
    const {
      fullName,
      phone,
      dateOfBirth,
      gender,
      address,
      nationalId,
      bloodType,
    } = dto;

    // 1. Check if User with this phone exists (registered patients)
    const existingUser = await this.userRepository.findByPhone(phone);

    if (existingUser) {
      return {
        id: existingUser.id,
        fullName: existingUser.fullName,
        phone: existingUser.phone,
        dateOfBirth: existingUser.dateOfBirth,
        gender: existingUser.gender,
        address: existingUser.address,
        role: UserRole.PATIENT,
        patientProfile: existingUser.patientProfile,
      };
    }

    // 2. Check if Guest PatientProfile with this phone exists
    const existingGuest =
      await this.profileRepository.findGuestPatientByPhone(phone);

    if (existingGuest) {
      return {
        id: existingGuest.id,
        fullName: existingGuest.fullName,
        phone: existingGuest.phone,
        dateOfBirth: existingGuest.dateOfBirth,
        gender: existingGuest.gender,
        address: existingGuest.address,
        role: UserRole.PATIENT,
        patientProfile: {
          id: existingGuest.id,
          patientCode: existingGuest.patientCode,
        },
      };
    }

    // 3. Create new Guest Profile
    const patientCode = await this.generatePatientCode();
    const guestData = {
      patientCode,
      fullName,
      phone,
      dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null,
      gender,
      address,
      nationalId,
      bloodType,
      isGuest: true,
    };

    const guestProfile = await this.profileRepository.createGuestPatientProfile(
      { data: guestData },
    );

    this.logger.log(
      `Successfully created guest patient profile ${guestProfile.id} with patient code ${patientCode}`,
    );

    return {
      id: guestProfile.id,
      fullName: guestProfile.fullName,
      phone: guestProfile.phone,
      dateOfBirth: guestProfile.dateOfBirth,
      gender: guestProfile.gender,
      address: guestProfile.address,
      role: UserRole.PATIENT,
      patientProfile: {
        id: guestProfile.id,
        patientCode: guestProfile.patientCode,
      },
    };
  }

  /**
   * Find all patient profiles with filters and pagination (ADMIN/RECEPTIONIST only)
   * Includes both guests and registered patients
   */
  async findAllPatients(filterDto: FilterPatientDto) {
    const { search, isGuest, page = 1, limit = 10 } = filterDto;

    const pPage = parseInt(String(page), 10) || 1;
    const pLimit = parseInt(String(limit), 10) || 10;

    const where: Prisma.PatientProfileWhereInput = {};

    if (search) {
      where.OR = [
        { fullName: { contains: search } },
        { phone: { contains: search } },
        { patientCode: { contains: search } },
        { nationalId: { contains: search } },
      ];
    }

    if (isGuest !== undefined) {
      where.isGuest = isGuest;
    }

    if (filterDto.gender) {
      const genders = filterDto.gender
        .split(',')
        .map((g) => g.trim() as Gender);
      where.gender = { in: genders };
    }

    if (filterDto.bloodType) {
      const bloodTypes = filterDto.bloodType.split(',').map((bt) => bt.trim());
      where.bloodType = { in: bloodTypes };
    }

    if (filterDto.status) {
      const statuses = filterDto.status.split(',').map((s) => s.trim());
      const hasActive = statuses.includes('active');
      const hasInactive = statuses.includes('inactive');
      if (hasActive && !hasInactive) {
        where.user = { isActive: true };
      } else if (hasInactive && !hasActive) {
        where.user = { isActive: false };
      }
    }

    const skip = (pPage - 1) * pLimit;
    const [profiles, total] =
      await this.profileRepository.findPatientProfilesWithPagination(
        where,
        skip,
        pLimit,
      );

    // Map profiles to a format the frontend expects (User-like objects)
    const users = profiles.map((profile) => {
      if (profile.user) {
        return {
          ...profile.user,
          patientProfile: {
            id: profile.id,
            patientCode: profile.patientCode,
          },
        };
      }
      // Guest profile mapping to User-like object
      return {
        id: profile.id, // Use profile ID as ID for guest
        fullName: profile.fullName,
        phone: profile.phone,
        email: profile.email,
        role: UserRole.PATIENT,
        isActive: true,
        patientProfile: {
          id: profile.id,
          patientCode: profile.patientCode,
        },
      };
    });

    return {
      items: users,
      total,
      page: pPage,
      limit: pLimit,
    };
  }

  /**
   * Get patient statistics for receptionist dashboard
   */
  async getPatientsStats() {
    const now = new Date();
    const startOfToday = new Date(now);
    startOfToday.setUTCHours(0, 0, 0, 0);

    const [totalPatients, newToday, activeAppointments] = await Promise.all([
      this.profileRepository.countTotalPatients(),
      this.profileRepository.countPatientsCreatedAfter(startOfToday),
      this.bookingRepository.countActiveAppointmentsGroup(startOfToday),
    ]);

    return {
      totalPatients,
      newToday,
      activeAppointments,
    };
  }

  /**
   * Update patient profile (RECEPTIONIST/ADMIN)
   */
  async updatePatientProfile(id: string, dto: UpdatePatientProfileDto) {
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

    const profileUpdateData = {
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
      nationalId: profileData.nationalId?.trim() || undefined,
      insuranceNumber: profileData.insuranceNumber?.trim() || undefined,
      insuranceProvider: profileData.insuranceProvider?.trim() || undefined,
      insuranceExpiry: profileData.insuranceExpiry?.trim()
        ? new Date(profileData.insuranceExpiry)
        : undefined,
      allergies: profileData.allergies?.trim() || undefined,
      chronicConditions: profileData.chronicConditions?.trim() || undefined,
      familyHistory: profileData.familyHistory?.trim() || undefined,
    };

    const userUpdateData = {
      email,
      fullName,
      phone,
      gender,
      dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : undefined,
      address,
    };

    const result = await this.profileRepository.updatePatientProfileTransaction(
      id,
      profileUpdateData,
      userUpdateData,
    );

    if (!result) {
      throw new ApiException(
        MessageCodes.PATIENT_NOT_FOUND,
        'Patient profile not found',
        404,
      );
    }

    this.logger.log(
      `Successfully updated patient profile ${id} and its associated user account (if any)`,
    );

    return result;
  }

  /**
   * Find all users with filters and pagination
   */
  async findAll(filterDto: FilterUserDto) {
    const {
      role,
      isActive,
      search,
      page = 1,
      limit = 10,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = filterDto;

    // Build where clause
    const where: Prisma.UserWhereInput = { deletedAt: null };

    if (role) {
      where.role = role;
    } else {
      where.role = {
        in: [UserRole.ADMIN, UserRole.RECEPTIONIST, UserRole.TECHNICIAN],
      };
    }

    if (typeof isActive === 'boolean') {
      where.isActive = isActive;
    }

    if (search) {
      where.OR = [
        { fullName: { contains: search } },
        { email: { contains: search } },
        { phone: { contains: search } },
      ];
    }

    const [users, total] = await this.userRepository.findUsersWithPagination(
      where,
      (page - 1) * limit,
      limit,
      sortBy,
      sortOrder,
    );

    return {
      users,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Find public doctors (no auth required)
   * Returns all active doctors when no serviceId is provided.
   * When serviceId is provided, filters doctors who can perform that service.
   */
  async findPublicDoctors(filters: {
    serviceId?: string;
    page?: number;
    limit?: number;
  }) {
    const { serviceId, page = 1, limit = 100 } = filters;
    const cacheKey = `cache:doctors:public:${serviceId || 'all'}:${page}:${limit}`;

    // Try to get from Redis cache first
    if (this.redisService.isReady()) {
      const cached = await this.redisService.getJson<{
        users: PublicDoctorResult[];
        pagination: {
          total: number;
          page: number;
          limit: number;
          totalPages: number;
        };
      }>(cacheKey);
      if (cached) {
        return cached;
      }
    }

    const skip = (page - 1) * limit;

    // Build Prisma where — always restrict to active doctors only
    const where: Prisma.UserWhereInput = {
      role: UserRole.DOCTOR,
      isActive: true,
      deletedAt: null,
      ...(serviceId
        ? {
            doctorProfile: {
              services: {
                some: { serviceId },
              },
            },
          }
        : {}),
    };

    const [users, total] = await this.userRepository.findPublicDoctors(
      where,
      skip,
      limit,
    );

    const result = {
      users,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };

    // Save to Redis cache (TTL: 2 hours = 7200 seconds)
    try {
      if (this.redisService.isReady()) {
        await this.redisService.setJson(cacheKey, result, 7200);
      }
    } catch (error) {
      this.logger.error(
        `Failed to cache public doctors:`,
        error instanceof Error ? error.stack : String(error),
      );
    }

    return result;
  }

  /**
   * Find public doctor by ID
   */
  async findPublicDoctor(id: string) {
    const user = await this.userRepository.findPublicDoctorById(id);

    if (!user) {
      throw new ApiException(
        MessageCodes.USER_NOT_FOUND,
        'Doctor not found',
        404,
        'Doctor retrieval failed',
      );
    }

    return user;
  }

  /**
   * Find one user by ID
   */
  async findOne(id: string) {
    const user = await this.userRepository.findById(id);

    if (!user) {
      throw new ApiException(
        MessageCodes.USER_NOT_FOUND,
        'User not found',
        404,
        'User retrieval failed',
      );
    }

    return user;
  }

  /**
   * Find user by email (for internal use)
   */
  async findByEmail(email: string) {
    return this.userRepository.findByEmail(email);
  }

  /**
   * Update user
   */
  async update(id: string, updateUserDto: UpdateUserDto) {
    // Check if user exists
    const existingUser = await this.userRepository.findById(id);

    if (!existingUser) {
      throw new ApiException(
        MessageCodes.USER_NOT_FOUND,
        'User not found',
        404,
        'User update failed',
      );
    }

    // Check email uniqueness if updating email
    if (updateUserDto.email && updateUserDto.email !== existingUser.email) {
      const emailExists = await this.userRepository.findByEmail(
        updateUserDto.email,
      );

      if (emailExists) {
        throw new ApiException(
          MessageCodes.USER_EMAIL_EXISTS,
          'Email already exists',
          409,
          'User update failed',
        );
      }
    }

    // Check phone uniqueness if updating phone
    if (updateUserDto.phone && updateUserDto.phone !== existingUser.phone) {
      const phoneExists = await this.userRepository.findByPhone(
        updateUserDto.phone,
      );

      if (phoneExists) {
        throw new ApiException(
          MessageCodes.USER_PHONE_EXISTS,
          'Phone number already exists',
          409,
          'User update failed',
        );
      }
    }

    // Prepare update data with proper typing
    const updateData: Prisma.UserUpdateInput = {};

    // Copy allowed fields
    if (
      updateUserDto.email !== undefined &&
      updateUserDto.email !== null &&
      updateUserDto.email !== ''
    )
      updateData.email = updateUserDto.email;
    if (
      updateUserDto.fullName !== undefined &&
      updateUserDto.fullName !== null &&
      updateUserDto.fullName !== ''
    )
      updateData.fullName = updateUserDto.fullName;
    if (
      updateUserDto.phone !== undefined &&
      updateUserDto.phone !== null &&
      updateUserDto.phone !== ''
    )
      updateData.phone = updateUserDto.phone;
    if (updateUserDto.gender !== undefined && updateUserDto.gender !== null)
      updateData.gender = updateUserDto.gender;
    if (
      updateUserDto.address !== undefined &&
      updateUserDto.address !== null &&
      updateUserDto.address !== ''
    )
      updateData.address = updateUserDto.address;
    if (updateUserDto.role !== undefined && updateUserDto.role !== null)
      updateData.role = updateUserDto.role;
    if (updateUserDto.isActive !== undefined && updateUserDto.isActive !== null)
      updateData.isActive = updateUserDto.isActive;

    // Hash password if provided
    if (
      updateUserDto.password !== undefined &&
      updateUserDto.password !== null &&
      updateUserDto.password !== ''
    ) {
      updateData.password = await bcrypt.hash(updateUserDto.password, 10);
    }

    // Convert dateOfBirth to Date if provided
    if (
      updateUserDto.dateOfBirth !== undefined &&
      updateUserDto.dateOfBirth !== null &&
      updateUserDto.dateOfBirth !== ''
    ) {
      updateData.dateOfBirth = new Date(updateUserDto.dateOfBirth);
    }

    // Auto-update PatientProfile if role is PATIENT and medical fields are passed
    if (existingUser.role === 'PATIENT') {
      const patientFields: any = {};
      if (updateUserDto.bloodType !== undefined) {
        patientFields.bloodType = updateUserDto.bloodType;
      }
      if (updateUserDto.heightCm !== undefined) {
        patientFields.heightCm = updateUserDto.heightCm;
      }
      if (updateUserDto.weightKg !== undefined) {
        patientFields.weightKg = updateUserDto.weightKg;
      }
      if (updateUserDto.allergies !== undefined) {
        patientFields.allergies = updateUserDto.allergies;
      }
      if (updateUserDto.chronicConditions !== undefined) {
        patientFields.chronicConditions = updateUserDto.chronicConditions;
      }

      if (Object.keys(patientFields).length > 0) {
        updateData.patientProfile = {
          update: patientFields,
        };
      }
    }

    // Update user
    // Auto-update DoctorProfile if role is DOCTOR and data is passed
    // NOTE: This complex nested update is handled gracefully by Prisma directly.
    // Given the repository pattern, we pass the raw data and let the repository figure it out.
    // However, PrismaUserRepository currently passes 'updateData' directly to 'this.prisma.user.update'.

    const updatedUser = await this.userRepository.update(id, updateData);

    this.logger.log(`Successfully updated user ${id}`);

    // Evict public doctors cache if updated user is a doctor
    if (
      existingUser.role === UserRole.DOCTOR ||
      updateUserDto.role === UserRole.DOCTOR
    ) {
      await this.clearPublicDoctorsCache();
    }

    return updatedUser;
  }

  /**
   * Update user avatar
   */
  async updateAvatar(id: string, avatarUrl: string) {
    const user = await this.userRepository.findById(id);

    if (!user) {
      throw new ApiException(
        MessageCodes.USER_NOT_FOUND,
        'User not found',
        404,
        'Avatar update failed',
      );
    }

    const updatedUser = await this.userRepository.update(id, {
      avatar: avatarUrl,
    });

    return updatedUser;
  }

  /**
   * Change password
   */
  async changePassword(userId: string, changePasswordDto: ChangePasswordDto) {
    const { currentPassword, newPassword } = changePasswordDto;

    // Get user with password
    const user = await this.userRepository.findById(userId);

    if (!user) {
      throw new ApiException(
        MessageCodes.USER_NOT_FOUND,
        'User not found',
        404,
        'Password change failed',
      );
    }

    // Verify current password
    const isPasswordValid = await bcrypt.compare(
      currentPassword,
      user.password,
    );

    if (!isPasswordValid) {
      throw new ApiException(
        MessageCodes.INVALID_CREDENTIALS,
        'Current password is incorrect',
        400,
        'Password change failed',
      );
    }

    if (newPassword === currentPassword) {
      throw new ApiException(
        MessageCodes.USER_PASSWORD_SAME_AS_OLD,
        'New password must be different from current password',
        400,
        'Password change failed',
      );
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update password
    await this.userRepository.update(userId, { password: hashedPassword });

    this.logger.log(`Successfully changed password for user ${userId}`);

    return null;
  }

  /**
   * Delete user (soft delete: sets deletedAt timestamp + deactivates account)
   */
  async remove(id: string) {
    const user = await this.userRepository.findById(id);

    if (!user) {
      throw new ApiException(
        MessageCodes.USER_NOT_FOUND,
        'User not found',
        404,
        'User deletion failed',
      );
    }

    // Soft delete: stamp deletedAt and deactivate
    const deletedUser = await this.userRepository.softDelete(id);

    this.logger.log(`Successfully soft deleted user ${id}`);

    // Evict public doctors cache if deleted user is a doctor
    if (user.role === UserRole.DOCTOR) {
      await this.clearPublicDoctorsCache();
    }

    return deletedUser;
  }

  /**
   * Get user statistics
   */
  async getStatistics() {
    const stats = await this.userRepository.getUserStatistics();

    return stats;
  }
}
