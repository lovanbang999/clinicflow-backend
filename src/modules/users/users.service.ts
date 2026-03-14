import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { FilterUserDto } from './dto/filter-user.dto';
import { Prisma, UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { ResponseHelper } from '../../common/interfaces/api-response.interface';
import { MessageCodes } from '../../common/constants/message-codes.const';
import { ApiException } from '../../common/exceptions/api.exception';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create a new user (ADMIN only)
   */
  async create(createUserDto: CreateUserDto) {
    const { email, password, fullName, phone, role } = createUserDto;

    // Check if email exists
    const existingUser = await this.prisma.user.findUnique({
      where: { email },
    });

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
      const existingPhone = await this.prisma.user.findFirst({
        where: { phone },
      });

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
    const user = await this.prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        fullName,
        phone,
        role,
        isActive: true,
      },
      select: {
        id: true,
        email: true,
        fullName: true,
        phone: true,
        avatar: true,
        dateOfBirth: true,
        gender: true,
        address: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        doctorProfile: {
          select: {
            specialties: true,
            qualifications: true,
            yearsOfExperience: true,
            bio: true,
            rating: true,
            reviewCount: true,
          },
        },
      },
    });

    return ResponseHelper.success(
      user,
      MessageCodes.USER_CREATED,
      'User created successfully',
      201,
    );
  }

  /**
   * Find all users with filters and pagination
   */
  async findAll(filterDto: FilterUserDto) {
    const { role, isActive, search, page = 1, limit = 10 } = filterDto;

    // Build where clause
    const where: Prisma.UserWhereInput = { deletedAt: null };

    if (role) {
      where.role = role;
    }

    if (typeof isActive === 'boolean') {
      where.isActive = isActive;
    }

    if (search) {
      where.OR = [
        { fullName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        select: {
          id: true,
          email: true,
          fullName: true,
          phone: true,
          avatar: true,
          dateOfBirth: true,
          gender: true,
          address: true,
          role: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
          doctorProfile: {
            select: {
              specialties: true,
              qualifications: true,
              yearsOfExperience: true,
              bio: true,
              rating: true,
              reviewCount: true,
            },
          },
        },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.user.count({ where }),
    ]);

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
   * Filter by serviceId to find doctors who can provide a specific service
   */
  async findPublicDoctors(filters: {
    serviceId?: string;
    page?: number;
    limit?: number;
  }) {
    const { serviceId, page = 1, limit = 100 } = filters;

    if (!serviceId) {
      throw new ApiException(
        MessageCodes.INVALID_QUERY,
        'serviceId query parameter is required',
        400,
        'Doctor retrieval failed',
      );
    }

    // Build where clause
    const where: Prisma.UserWhereInput = {
      role: UserRole.DOCTOR,
      isActive: true, // Only active doctors
    };

    // Filter by serviceId using the DoctorService join table
    if (serviceId && serviceId !== 'all') {
      where.doctorProfile = {
        services: {
          some: {
            serviceId,
          },
        },
      };
    }

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        select: {
          id: true,
          email: true,
          fullName: true,
          phone: true,
          avatar: true,
          dateOfBirth: true,
          gender: true,
          address: true,
          role: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
          doctorProfile: {
            select: {
              specialties: true,
              qualifications: true,
              yearsOfExperience: true,
              bio: true,
              rating: true,
              reviewCount: true,
              services: {
                select: {
                  service: {
                    select: {
                      id: true,
                      name: true,
                      category: true,
                    },
                  },
                },
              },
            },
          },
        },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: [
          { doctorProfile: { rating: 'desc' } }, // Sort by rating first
          { fullName: 'asc' },
        ],
      }),
      this.prisma.user.count({ where }),
    ]);

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
    const user = await this.prisma.user.findFirst({
      where: {
        id,
        role: UserRole.DOCTOR,
        isActive: true,
      },
      select: {
        id: true,
        email: true,
        fullName: true,
        phone: true,
        avatar: true,
        gender: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        doctorProfile: {
          select: {
            specialties: true,
            qualifications: true,
            yearsOfExperience: true,
            bio: true,
            rating: true,
            reviewCount: true,
          },
        },
      },
    });

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
    const user = await this.prisma.user.findFirst({
      where: { id, deletedAt: null },
      select: {
        id: true,
        email: true,
        fullName: true,
        phone: true,
        avatar: true,
        dateOfBirth: true,
        gender: true,
        address: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        doctorProfile: {
          select: {
            specialties: true,
            qualifications: true,
            yearsOfExperience: true,
            bio: true,
            rating: true,
            reviewCount: true,
          },
        },
      },
    });

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
    return this.prisma.user.findUnique({
      where: { email },
      include: {
        doctorProfile: true,
      },
    });
  }

  /**
   * Update user
   */
  async update(id: string, updateUserDto: UpdateUserDto) {
    // Check if user exists
    const existingUser = await this.prisma.user.findUnique({
      where: { id },
    });

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
      const emailExists = await this.prisma.user.findUnique({
        where: { email: updateUserDto.email },
      });

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
      const phoneExists = await this.prisma.user.findFirst({
        where: {
          phone: updateUserDto.phone,
          NOT: { id },
        },
      });

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
    const updatedUser = await this.prisma.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        email: true,
        fullName: true,
        phone: true,
        avatar: true,
        dateOfBirth: true,
        gender: true,
        address: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        doctorProfile: {
          select: {
            specialties: true,
            qualifications: true,
            yearsOfExperience: true,
            bio: true,
            rating: true,
            reviewCount: true,
          },
        },
      },
    });

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
    const user = await this.prisma.user.findUnique({ where: { id } });

    if (!user) {
      throw new ApiException(
        MessageCodes.USER_NOT_FOUND,
        'User not found',
        404,
        'Avatar update failed',
      );
    }

    const updatedUser = await this.prisma.user.update({
      where: { id },
      data: { avatar: avatarUrl },
      select: {
        id: true,
        email: true,
        fullName: true,
        phone: true,
        avatar: true,
        dateOfBirth: true,
        gender: true,
        address: true,
        role: true,
        isActive: true,
      },
    });

    return updatedUser;
  }

  /**
   * Change password
   */
  async changePassword(userId: string, changePasswordDto: ChangePasswordDto) {
    const { currentPassword, newPassword } = changePasswordDto;

    // Get user with password
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, password: true },
    });

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
    await this.prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword },
    });

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
    const user = await this.prisma.user.findFirst({
      where: { id, deletedAt: null },
    });

    if (!user) {
      throw new ApiException(
        MessageCodes.USER_NOT_FOUND,
        'User not found',
        404,
        'User deletion failed',
      );
    }

    // Soft delete: stamp deletedAt and deactivate
    const deletedUser = await this.prisma.user.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        isActive: false,
      },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        isActive: true,
        deletedAt: true,
      },
    });

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
    const [totalUsers, activeUsers, usersByRole, doctorProfileCount] =
      await Promise.all([
        this.prisma.user.count({ where: { deletedAt: null } }),
        this.prisma.user.count({ where: { isActive: true, deletedAt: null } }),
        this.prisma.user.groupBy({
          by: ['role'],
          where: { deletedAt: null },
          _count: true,
        }),
        this.prisma.doctorProfile.count(),
      ]);

    const roleStats = usersByRole.reduce(
      (acc, item) => {
        acc[item.role] = item._count;
        return acc;
      },
      {} as Record<string, number>,
    );

    return ResponseHelper.success(
      {
        totalUsers,
        activeUsers,
        inactiveUsers: totalUsers - activeUsers,
        usersByRole: roleStats,
        doctorProfileCount,
      },
      MessageCodes.USER_LIST_RETRIEVED,
      'User statistics retrieved successfully',
      200,
    );
  }
}
