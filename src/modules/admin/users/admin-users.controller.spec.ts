import { Test, TestingModule } from '@nestjs/testing';
import { AdminUsersController } from './admin-users.controller';
import { UsersService } from '../../users/users.service';
import { AdminCreateUserDto } from './dto/admin-create-user.dto';
import { FilterUserDto } from '../../users/dto/filter-user.dto';
import { AdminSuspendUserDto } from './dto/admin-suspend-user.dto';
import { UpdateUserDto } from 'src/modules/users/dto/update-user.dto';
import { UserRole, User } from '@prisma/client';
import {
  ForbiddenException,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';

describe('AdminUsersController', () => {
  let controller: AdminUsersController;
  let serviceMock: Record<string, jest.Mock>;

  beforeEach(async () => {
    serviceMock = {
      findAll: jest.fn(),
      getStatistics: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminUsersController],
      providers: [{ provide: UsersService, useValue: serviceMock }],
    }).compile();

    controller = module.get<AdminUsersController>(AdminUsersController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getUsers', () => {
    it('should forward FilterUserDto to service and return result', async () => {
      const filter: FilterUserDto = {
        role: UserRole.RECEPTIONIST,
        isActive: true,
        search: 'Jane',
        page: 1,
        limit: 10,
      };
      const expectedResult = { users: [], total: 0 };
      serviceMock.findAll.mockResolvedValue(expectedResult);

      const result = await controller.getUsers(filter);

      expect(serviceMock.findAll).toHaveBeenCalledWith(filter);
      expect(result).toBe(expectedResult);
    });

    it('should throw ForbiddenException if query role is DOCTOR', () => {
      const filter: FilterUserDto = { role: UserRole.DOCTOR };
      expect(() => controller.getUsers(filter)).toThrow(
        new ForbiddenException(
          'Cannot query DOCTOR or PATIENT roles from this endpoint',
        ),
      );
      expect(serviceMock.findAll).not.toHaveBeenCalled();
    });

    it('should throw ForbiddenException if query role is PATIENT', () => {
      const filter: FilterUserDto = { role: UserRole.PATIENT };
      expect(() => controller.getUsers(filter)).toThrow(
        new ForbiddenException(
          'Cannot query DOCTOR or PATIENT roles from this endpoint',
        ),
      );
      expect(serviceMock.findAll).not.toHaveBeenCalled();
    });
  });

  describe('getUserStatistics', () => {
    it('should call getStatistics on service and return value', async () => {
      const stats = { totalUsers: 20 };
      serviceMock.getStatistics.mockResolvedValue(stats);

      const result = await controller.getUserStatistics();

      expect(serviceMock.getStatistics).toHaveBeenCalled();
      expect(result).toBe(stats);
    });
  });

  describe('getUserById', () => {
    it('should call findOne with id and return user', async () => {
      const userId = 'user-uuid';
      const user = { id: userId, fullName: 'John Doe' };
      serviceMock.findOne.mockResolvedValue(user);

      const result = await controller.getUserById(userId);

      expect(serviceMock.findOne).toHaveBeenCalledWith(userId);
      expect(result).toBe(user);
    });

    it('should propagate NotFoundException from service', async () => {
      const userId = 'invalid-uuid';
      serviceMock.findOne.mockRejectedValue(new NotFoundException());

      await expect(controller.getUserById(userId)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('createUser', () => {
    it('should forward DTO to service and return result', async () => {
      const dto: AdminCreateUserDto = {
        email: 'receptionist@smartclinic.com',
        phone: '1234567890',
        fullName: 'Jane Doe',
        password: 'SecurePass123!',
        role: UserRole.RECEPTIONIST,
      };
      const expectedResult = { id: 'user-123', ...dto };
      serviceMock.create.mockResolvedValue(expectedResult);

      const result = await controller.createUser(dto);

      expect(serviceMock.create).toHaveBeenCalledWith(dto);
      expect(result).toBe(expectedResult);
    });

    it('should throw ForbiddenException if creating DOCTOR', () => {
      const dto: AdminCreateUserDto = {
        email: 'doctor@smartclinic.com',
        phone: '1234567890',
        fullName: 'Dr. Jane',
        password: 'SecurePass123!',
        role: UserRole.DOCTOR,
      };
      expect(() => controller.createUser(dto)).toThrow(
        new ForbiddenException(
          'Use dedicated endpoints to create doctors and patients',
        ),
      );
      expect(serviceMock.create).not.toHaveBeenCalled();
    });

    it('should throw ForbiddenException if creating PATIENT', () => {
      const dto: AdminCreateUserDto = {
        email: 'patient@smartclinic.com',
        phone: '1234567890',
        fullName: 'Jane Patient',
        password: 'SecurePass123!',
        role: UserRole.PATIENT,
      };
      expect(() => controller.createUser(dto)).toThrow(
        new ForbiddenException(
          'Use dedicated endpoints to create doctors and patients',
        ),
      );
      expect(serviceMock.create).not.toHaveBeenCalled();
    });

    it('should propagate ConflictException from service', async () => {
      const dto: AdminCreateUserDto = {
        email: 'receptionist@smartclinic.com',
        phone: '1234567890',
        fullName: 'Jane Doe',
        password: 'SecurePass123!',
        role: UserRole.RECEPTIONIST,
      };
      serviceMock.create.mockRejectedValue(
        new ConflictException('Email already exists'),
      );

      await expect(controller.createUser(dto)).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('updateUser', () => {
    it('should call update with id and DTO and return result', async () => {
      const userId = 'user-uuid';
      const dto: UpdateUserDto = { fullName: 'Jane Smith' };
      const expectedResult = { id: userId, ...dto };
      serviceMock.update.mockResolvedValue(expectedResult);

      const result = await controller.updateUser(userId, dto);

      expect(serviceMock.update).toHaveBeenCalledWith(userId, dto);
      expect(result).toBe(expectedResult);
    });
  });

  describe('suspendUser', () => {
    const mockCurrentUser = { id: 'admin-id' } as User;

    it('should call update on service to suspend the user', async () => {
      const targetUserId = 'target-user-uuid';
      const dto: AdminSuspendUserDto = {
        isActive: false,
        reason: 'Disciplinary action',
      };
      const expectedResult = { id: targetUserId, isActive: false };
      serviceMock.update.mockResolvedValue(expectedResult);

      const result = await controller.suspendUser(
        targetUserId,
        dto,
        mockCurrentUser,
      );

      expect(serviceMock.update).toHaveBeenCalledWith(targetUserId, {
        isActive: false,
        lockReason: 'Disciplinary action',
      });
      expect(result).toBe(expectedResult);
    });

    it('should call update on service to reinstate user with lockReason as null', async () => {
      const targetUserId = 'target-user-uuid';
      const dto: AdminSuspendUserDto = { isActive: true };
      const expectedResult = { id: targetUserId, isActive: true };
      serviceMock.update.mockResolvedValue(expectedResult);

      const result = await controller.suspendUser(
        targetUserId,
        dto,
        mockCurrentUser,
      );

      expect(serviceMock.update).toHaveBeenCalledWith(targetUserId, {
        isActive: true,
        lockReason: null,
      });
      expect(result).toBe(expectedResult);
    });

    it('should throw ForbiddenException if user tries to suspend their own account', () => {
      const targetUserId = 'admin-id';
      const dto: AdminSuspendUserDto = { isActive: false };
      expect(() =>
        controller.suspendUser(targetUserId, dto, mockCurrentUser),
      ).toThrow(new ForbiddenException('Cannot lock your own account'));
      expect(serviceMock.update).not.toHaveBeenCalled();
    });
  });

  describe('deleteUser', () => {
    it('should call remove with id and return value', async () => {
      const userId = 'user-uuid';
      const expectedResult = { id: userId, isActive: false };
      serviceMock.remove.mockResolvedValue(expectedResult);

      const result = await controller.deleteUser(userId);

      expect(serviceMock.remove).toHaveBeenCalledWith(userId);
      expect(result).toBe(expectedResult);
    });
  });
});
