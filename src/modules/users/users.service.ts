import {
  IUserRepository,
  I_USER_REPOSITORY,
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
import { Injectable, Inject } from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { FilterUserDto } from './dto/filter-user.dto';
import { FilterPatientDto } from './dto/filter-patient.dto';
import { UpdatePatientProfileDto } from './dto/update-patient-profile.dto';
import { Prisma, UserRole, Gender } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { ResponseHelper } from '../../common/interfaces/api-response.interface';
import { MessageCodes } from '../../common/constants/message-codes.const';
import { ApiException } from '../../common/exceptions/api.exception';

@Injectable()
export class UsersService {
  constructor(
    @Inject(I_USER_REPOSITORY) private readonly userRepository: IUserRepository,
    @Inject(I_PROFILE_REPOSITORY)
    private readonly profileRepository: IProfileRepository,
    @Inject(I_BOOKING_REPOSITORY)
    private readonly bookingRepository: IBookingRepository,
  ) {}

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

    return ResponseHelper.success(
      user,
      MessageCodes.USER_CREATED,
      'User created successfully',
      201,
    );
  }

  /**
   * Internal helper to generate a unique patient code (BN-YYYY-NNNN)
   */
  private async generatePatientCode(): Promise<string> {
    const count = await this.profileRepository.countTotalPatients();
    return `BN-${new Date().getFullYear()}-${String(count + 1).padStart(4, '0')}`;
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
      return ResponseHelper.success(
        existingUser,
        MessageCodes.USER_ALREADY_EXISTS,
        'Patient already has an account',
        200,
      );
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

      return ResponseHelper.success(
        upgradedUserWithProfile,
        MessageCodes.USER_UPDATED,
        'Guest patient upgraded to account successfully',
        200,
      );
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

    return ResponseHelper.success(
      result,
      MessageCodes.USER_CREATED,
      'Patient account created successfully',
      201,
    );
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
      return ResponseHelper.success(
        {
          id: existingUser.id,
          fullName: existingUser.fullName,
          phone: existingUser.phone,
          dateOfBirth: existingUser.dateOfBirth,
          gender: existingUser.gender,
          address: existingUser.address,
          role: UserRole.PATIENT,
          patientProfile: existingUser.patientProfile,
        },
        MessageCodes.USER_RETRIEVED,
        'Patient already exists with a system account',
        200,
      );
    }

    // 2. Check if Guest PatientProfile with this phone exists
    const existingGuest =
      await this.profileRepository.findGuestPatientByPhone(phone);

    if (existingGuest) {
      return ResponseHelper.success(
        {
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
        },
        MessageCodes.USER_RETRIEVED,
        'Guest patient found',
        200,
      );
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

    return ResponseHelper.success(
      {
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
      },
      MessageCodes.USER_CREATED,
      'Guest patient created successfully',
      201,
    );
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
        { fullName: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search, mode: 'insensitive' } },
        { patientCode: { contains: search, mode: 'insensitive' } },
        { nationalId: { contains: search, mode: 'insensitive' } },
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

    return ResponseHelper.success(
      {
        users,
        pagination: {
          total,
          page: pPage,
          limit: pLimit,
          totalPages: Math.ceil(total / pLimit),
        },
      },
      MessageCodes.USER_LIST_RETRIEVED,
      'Patient profiles retrieved successfully',
      200,
    );
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

    return ResponseHelper.success(
      {
        totalPatients,
        newToday,
        activeAppointments,
      },
      MessageCodes.PATIENT_STATS_RETRIEVED,
      'Patient statistics retrieved successfully',
      200,
    );
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

    return ResponseHelper.success(
      result,
      MessageCodes.PATIENT_UPDATED,
      'Patient profile updated successfully',
      200,
    );
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
        { fullName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [users, total] = await this.userRepository.findUsersWithPagination(
      where,
      (page - 1) * limit,
      limit,
      sortBy,
      sortOrder,
    );

    return ResponseHelper.success(
      {
        users,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
      },
      MessageCodes.USER_LIST_RETRIEVED,
      'Users retrieved successfully',
      200,
    );
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

    return ResponseHelper.success(
      {
        users,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
      },
      MessageCodes.USER_LIST_RETRIEVED,
      'Doctors retrieved successfully',
      200,
    );
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

    return ResponseHelper.success(
      user,
      MessageCodes.USER_RETRIEVED,
      'Doctor retrieved successfully',
      200,
    );
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

    return ResponseHelper.success(
      user,
      MessageCodes.USER_RETRIEVED,
      'User retrieved successfully',
      200,
    );
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

    // Update user
    // Auto-update DoctorProfile if role is DOCTOR and data is passed
    // NOTE: This complex nested update is handled gracefully by Prisma directly.
    // Given the repository pattern, we pass the raw data and let the repository figure it out.
    // However, PrismaUserRepository currently passes 'updateData' directly to 'this.prisma.user.update'.

    const updatedUser = await this.userRepository.update(id, updateData);

    return ResponseHelper.success(
      updatedUser,
      MessageCodes.USER_UPDATED,
      'User updated successfully',
      200,
    );
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

    return ResponseHelper.success(
      null,
      MessageCodes.USER_UPDATED,
      'Password changed successfully',
      200,
    );
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

    return ResponseHelper.success(
      deletedUser,
      MessageCodes.USER_DELETED,
      'User deleted successfully',
      200,
    );
  }

  /**
   * Get user statistics
   */
  async getStatistics() {
    const stats = await this.userRepository.getUserStatistics();

    return ResponseHelper.success(
      stats,
      MessageCodes.USER_LIST_RETRIEVED,
      'User statistics retrieved successfully',
      200,
    );
  }
}
