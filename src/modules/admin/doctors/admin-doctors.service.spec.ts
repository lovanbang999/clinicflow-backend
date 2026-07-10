import { Test, TestingModule } from '@nestjs/testing';
import { AdminDoctorsService } from './admin-doctors.service';
import { I_USER_REPOSITORY } from '../../database/interfaces/user.repository.interface';
import { UsersService } from '../../users/users.service';
import { UserRole } from '@prisma/client';
import { ApiException } from '../../../common/exceptions/api.exception';

describe('AdminDoctorsService', () => {
  let service: AdminDoctorsService;
  let userRepositoryMock: Record<string, jest.Mock>;
  let usersServiceMock: Record<string, jest.Mock>;

  beforeEach(async () => {
    userRepositoryMock = {
      getDoctorDashboardStats: jest.fn(),
      findAdminDoctorsPage: jest.fn(),
      findAdminDoctorDetailById: jest.fn(),
      findDoctorById: jest.fn(),
      upsertDoctorProfileByUserId: jest.fn(),
      syncDoctorServices: jest.fn(),
      update: jest.fn(),
    };

    usersServiceMock = {
      create: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminDoctorsService,
        { provide: I_USER_REPOSITORY, useValue: userRepositoryMock },
        { provide: UsersService, useValue: usersServiceMock },
      ],
    }).compile();

    service = module.get<AdminDoctorsService>(AdminDoctorsService);
  });

  describe('getDoctorStatistics', () => {
    it('should return statistics mapped correctly', async () => {
      userRepositoryMock.getDoctorDashboardStats.mockResolvedValue({
        totalDoctors: 20,
        activeDoctors: 15,
        newThisMonth: 2,
        bySpecialty: [{ specialty: 'Cardiology', count: 5 }],
      });

      const stats = await service.getDoctorStatistics();

      expect(userRepositoryMock.getDoctorDashboardStats).toHaveBeenCalled();
      expect(stats.totalDoctors).toBe(20);
      expect(stats.activeDoctors).toBe(15);
      expect(stats.inactiveDoctors).toBe(5);
      expect(stats.newThisMonth).toBe(2);
      expect(stats.bySpecialty).toEqual([
        { specialty: 'Cardiology', count: 5 },
      ]);
    });
  });

  describe('findAllDoctors', () => {
    it('should query UserRepository findAdminDoctorsPage', async () => {
      userRepositoryMock.findAdminDoctorsPage.mockResolvedValue([
        [{ id: 'doc-1', fullName: 'Dr. House' }],
        1,
      ]);

      const result = await service.findAllDoctors({ page: 1, limit: 10 });

      expect(userRepositoryMock.findAdminDoctorsPage).toHaveBeenCalled();
      expect(result.doctors.length).toBe(1);
      expect(result.pagination.total).toBe(1);
    });
  });

  describe('findOneDoctor', () => {
    it('should return doctor detail if exists', async () => {
      userRepositoryMock.findAdminDoctorDetailById.mockResolvedValue({
        id: 'doc-1',
        fullName: 'Dr. House',
      });

      const result = await service.findOneDoctor('doc-1');

      expect(userRepositoryMock.findAdminDoctorDetailById).toHaveBeenCalledWith(
        'doc-1',
      );
      expect(result.fullName).toBe('Dr. House');
    });

    it('should throw USER_NOT_FOUND if doctor not found', async () => {
      userRepositoryMock.findAdminDoctorDetailById.mockResolvedValue(null);

      await expect(service.findOneDoctor('doc-1')).rejects.toThrow(
        ApiException,
      );
    });
  });

  describe('updateDoctorProfile', () => {
    const dto = {
      bio: 'Experience',
      serviceIds: ['svc-1', 'svc-2'],
    };

    it('should throw USER_NOT_FOUND if doctor is not found', async () => {
      userRepositoryMock.findDoctorById.mockResolvedValue(null);

      await expect(service.updateDoctorProfile('doc-1', dto)).rejects.toThrow(
        ApiException,
      );
    });

    it('should upsert profile and sync services if doctor exists', async () => {
      userRepositoryMock.findDoctorById.mockResolvedValue({ id: 'doc-1' });
      userRepositoryMock.upsertDoctorProfileByUserId.mockResolvedValue({
        id: 'prof-1',
        bio: dto.bio,
      });

      const result = await service.updateDoctorProfile('doc-1', dto);

      expect(
        userRepositoryMock.upsertDoctorProfileByUserId,
      ).toHaveBeenCalledWith('doc-1', dto);
      expect(userRepositoryMock.syncDoctorServices).toHaveBeenCalledWith(
        'prof-1',
        dto.serviceIds,
      );
      expect(result.bio).toBe('Experience');
    });
  });

  describe('toggleDoctorActive', () => {
    it('should throw USER_NOT_FOUND if doctor is not found', async () => {
      userRepositoryMock.findDoctorById.mockResolvedValue(null);

      await expect(
        service.toggleDoctorActive('doc-1', { isActive: false }),
      ).rejects.toThrow(ApiException);
    });

    it('should toggle status successfully', async () => {
      userRepositoryMock.findDoctorById.mockResolvedValue({ id: 'doc-1' });
      userRepositoryMock.update.mockResolvedValue({
        id: 'doc-1',
        isActive: false,
      });

      const result = await service.toggleDoctorActive('doc-1', {
        isActive: false,
      });

      expect(userRepositoryMock.update).toHaveBeenCalledWith('doc-1', {
        isActive: false,
      });
      expect(result.isActive).toBe(false);
    });
  });

  describe('createDoctor', () => {
    it('should delegate creation to UsersService with DOCTOR role', async () => {
      const createDto = {
        email: 'doctor@example.com',
        fullName: 'Dr. House',
        password: 'securePassword123',
      };
      usersServiceMock.create.mockResolvedValue({
        id: 'doc-1',
        role: UserRole.DOCTOR,
      });

      const result = await service.createDoctor(createDto);

      expect(usersServiceMock.create).toHaveBeenCalledWith({
        ...createDto,
        role: UserRole.DOCTOR,
      });
      expect(result.id).toBe('doc-1');
    });
  });
});
