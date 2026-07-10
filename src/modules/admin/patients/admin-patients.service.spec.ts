import { Test, TestingModule } from '@nestjs/testing';
import { AdminPatientsService } from './admin-patients.service';
import { I_PROFILE_REPOSITORY } from '../../database/interfaces/profile.repository.interface';
import { I_USER_REPOSITORY } from '../../database/interfaces/user.repository.interface';
import { I_BOOKING_REPOSITORY } from '../../database/interfaces/booking.repository.interface';
import { Gender } from '@prisma/client';
import { ApiException } from '../../../common/exceptions/api.exception';

describe('AdminPatientsService', () => {
  let service: AdminPatientsService;
  let profileRepositoryMock: Record<string, jest.Mock>;
  let userRepositoryMock: Record<string, jest.Mock>;
  let bookingRepositoryMock: Record<string, jest.Mock>;

  beforeEach(async () => {
    profileRepositoryMock = {
      countTotalPatients: jest.fn(),
      createPatientProfile: jest.fn(),
      findPatientProfileById: jest.fn(),
      findAdminPatientDetailById: jest.fn(),
      findAdminPatientsPage: jest.fn(),
      updatePatientProfileTransaction: jest.fn(),
      findHealthProfile: jest.fn(),
      getPatientDashboardStats: jest.fn(),
    };

    userRepositoryMock = {
      findByEmailOrPhone: jest.fn(),
      createRegisteredPatient: jest.fn(),
      createGuestAsUserTransaction: jest.fn(),
    };

    bookingRepositoryMock = {
      findPatientLastAndNextBookings: jest.fn(),
      getBookingDashboardStats: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminPatientsService,
        { provide: I_PROFILE_REPOSITORY, useValue: profileRepositoryMock },
        { provide: I_USER_REPOSITORY, useValue: userRepositoryMock },
        { provide: I_BOOKING_REPOSITORY, useValue: bookingRepositoryMock },
      ],
    }).compile();

    service = module.get<AdminPatientsService>(AdminPatientsService);
  });

  describe('create', () => {
    const dto = {
      email: 'test@example.com',
      fullName: 'John Doe',
      phone: '0987654321',
      gender: Gender.MALE,
      dateOfBirth: '1990-01-01',
      address: '123 Main St',
      bloodType: 'O+',
      createAppAccount: false,
      nationalId: '123456789',
      insuranceNumber: 'INS-123',
      insuranceProvider: 'PVI',
      insuranceExpiry: '2030-12-31',
      allergies: 'None',
      chronicConditions: 'None',
      familyHistory: 'None',
    };

    it('should create a guest patient profile (no app account)', async () => {
      profileRepositoryMock.countTotalPatients.mockResolvedValue(10);
      profileRepositoryMock.createPatientProfile.mockResolvedValue({
        id: 'profile-1',
        fullName: dto.fullName,
        patientCode: 'BN-2026-0011',
      });

      const result = (await service.create(dto)) as { profile: unknown };

      expect(profileRepositoryMock.countTotalPatients).toHaveBeenCalled();
      expect(profileRepositoryMock.createPatientProfile).toHaveBeenCalledWith({
        data: expect.objectContaining({
          fullName: dto.fullName,
          patientCode: expect.stringContaining('BN-') as unknown,
          isGuest: true,
        }) as unknown,
      });
      expect(result.profile).toBeDefined();
    });

    it('should throw PATIENT_EXISTS if app account creation requested and email/phone already exists', async () => {
      userRepositoryMock.findByEmailOrPhone.mockResolvedValue({ id: 'user-1' });

      await expect(
        service.create({ ...dto, createAppAccount: true }),
      ).rejects.toThrow(ApiException);
    });

    it('should create registered patient (with user account)', async () => {
      userRepositoryMock.findByEmailOrPhone.mockResolvedValue(null);
      profileRepositoryMock.countTotalPatients.mockResolvedValue(10);
      userRepositoryMock.createRegisteredPatient.mockResolvedValue({
        id: 'user-1',
        email: dto.email,
        patientProfile: {
          id: 'profile-1',
          fullName: dto.fullName,
        },
      });

      const result = (await service.create({
        ...dto,
        createAppAccount: true,
      })) as { profile: unknown };

      expect(userRepositoryMock.createRegisteredPatient).toHaveBeenCalled();
      expect(result.profile).toBeDefined();
    });
  });

  describe('createGuest', () => {
    it('should create guest patient', async () => {
      profileRepositoryMock.countTotalPatients.mockResolvedValue(5);
      profileRepositoryMock.createPatientProfile.mockResolvedValue({
        id: 'profile-2',
        fullName: 'Jane Doe',
      });

      const result = await service.createGuest({
        fullName: 'Jane Doe',
        phone: '0123456789',
      });

      expect(result).toBeDefined();
      expect(profileRepositoryMock.createPatientProfile).toHaveBeenCalled();
    });
  });

  describe('upgradeGuestToUser', () => {
    it('should throw PATIENT_NOT_FOUND if profile not found', async () => {
      profileRepositoryMock.findPatientProfileById.mockResolvedValue(null);

      await expect(
        service.upgradeGuestToUser('profile-1', { email: 'test@example.com' }),
      ).rejects.toThrow(ApiException);
    });

    it('should throw PATIENT_EXISTS if profile is already registered (not guest)', async () => {
      profileRepositoryMock.findPatientProfileById.mockResolvedValue({
        id: 'profile-1',
        isGuest: false,
      });

      await expect(
        service.upgradeGuestToUser('profile-1', { email: 'test@example.com' }),
      ).rejects.toThrow(ApiException);
    });

    it('should successfully upgrade guest to registered user', async () => {
      profileRepositoryMock.findPatientProfileById.mockResolvedValue({
        id: 'profile-1',
        isGuest: true,
        fullName: 'Guest User',
      });
      userRepositoryMock.createGuestAsUserTransaction.mockResolvedValue({
        id: 'user-1',
        patientProfile: {
          id: 'profile-1',
          isGuest: false,
        },
      });

      const result = await service.upgradeGuestToUser('profile-1', {
        email: 'test@example.com',
        password: 'securePassword123',
      });

      expect(
        userRepositoryMock.createGuestAsUserTransaction,
      ).toHaveBeenCalled();
      expect(result.user).toBeDefined();
      expect(result.profile.isGuest).toBe(false);
    });
  });

  describe('findAll', () => {
    it('should list patients and enrich with bookings', async () => {
      profileRepositoryMock.findAdminPatientsPage.mockResolvedValue([
        [
          {
            id: 'profile-1',
            fullName: 'Patient One',
            email: 'one@example.com',
            user: { isActive: true, avatar: null },
          },
        ],
        1,
      ]);
      bookingRepositoryMock.findPatientLastAndNextBookings.mockResolvedValue([
        [{ patientProfileId: 'profile-1', bookingDate: new Date() }], // last
        [{ patientProfileId: 'profile-1', bookingDate: new Date() }], // next
      ]);

      const result = await service.findAll({ page: 1, limit: 10 });

      expect(profileRepositoryMock.findAdminPatientsPage).toHaveBeenCalled();
      expect(
        bookingRepositoryMock.findPatientLastAndNextBookings,
      ).toHaveBeenCalled();
      expect(result.data.length).toBe(1);
      expect(result.meta.total).toBe(1);
    });
  });

  describe('exportToExcel', () => {
    it('should generate workbook buffer', async () => {
      profileRepositoryMock.findAdminPatientsPage.mockResolvedValue([
        [
          {
            patientCode: 'BN-1',
            fullName: 'Patient One',
            isGuest: false,
            user: { isActive: true },
          },
        ],
        1,
      ]);

      const buffer = await service.exportToExcel({});
      expect(buffer).toBeDefined();
    });
  });

  describe('getStats', () => {
    it('should return computed statistics and trends', async () => {
      profileRepositoryMock.getPatientDashboardStats.mockResolvedValue({
        totalPatients: 100,
        totalPatientsLastMonthEnd: 80,
        newThisMonth: 20,
        newLastMonth: 10,
      });
      bookingRepositoryMock.getBookingDashboardStats.mockResolvedValue({
        patientsTodayCount: 5,
        patientsLastWeekDayCount: 4,
        activeAppointments: 10,
        activeAppointmentsLastMonth: 8,
      });

      const stats = await service.getStats();

      expect(stats.totalPatients).toBe(100);
      expect(stats.totalPatientsTrend).toBe(25);
      expect(stats.newThisMonthTrend).toBe(100);
    });
  });

  describe('findOne', () => {
    it('should return patient detail if found', async () => {
      profileRepositoryMock.findAdminPatientDetailById.mockResolvedValue({
        id: 'profile-1',
        fullName: 'Jane',
      });

      const result = await service.findOne('profile-1');
      expect(result).toBeDefined();
      expect(result.fullName).toBe('Jane');
    });

    it('should throw PATIENT_NOT_FOUND if patient detail is missing', async () => {
      profileRepositoryMock.findAdminPatientDetailById.mockResolvedValue(null);

      await expect(service.findOne('profile-1')).rejects.toThrow(ApiException);
    });
  });

  describe('update', () => {
    it('should update patient and related user account if exists', async () => {
      profileRepositoryMock.findAdminPatientDetailById.mockResolvedValue({
        id: 'profile-1',
        userId: 'user-1',
      });
      profileRepositoryMock.updatePatientProfileTransaction.mockResolvedValue({
        id: 'profile-1',
        fullName: 'Jane Updated',
      });

      const result = await service.update('profile-1', {
        fullName: 'Jane Updated',
      });

      expect(
        profileRepositoryMock.updatePatientProfileTransaction,
      ).toHaveBeenCalledWith(
        'profile-1',
        expect.objectContaining({ fullName: 'Jane Updated' }),
        expect.objectContaining({ fullName: 'Jane Updated' }),
      );
      expect(result.fullName).toBe('Jane Updated');
    });
  });

  describe('getHealthProfile', () => {
    it('should return health profile if exists', async () => {
      profileRepositoryMock.findHealthProfile.mockResolvedValue({
        id: 'profile-1',
        allergies: 'peanuts',
      });

      const result = await service.getHealthProfile('profile-1');
      expect(result.allergies).toBe('peanuts');
    });

    it('should throw PATIENT_NOT_FOUND if health profile is not found', async () => {
      profileRepositoryMock.findHealthProfile.mockResolvedValue(null);

      await expect(service.getHealthProfile('profile-1')).rejects.toThrow(
        ApiException,
      );
    });
  });
});
