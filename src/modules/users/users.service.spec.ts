import { Test, TestingModule } from '@nestjs/testing';
import { UsersService } from './users.service';
import { SequenceService } from '../database/services/sequence.service';
import { RedisService } from '../database/services/redis.service';
import { MailService } from '../notifications/mail.service';
import { UserRole } from '@prisma/client';
import { ApiException } from '../../common/exceptions/api.exception';

describe('UsersService', () => {
  let service: UsersService;
  let mockUserRepository: {
    findByEmail: jest.Mock;
    findByPhone: jest.Mock;
    findByPhoneOrEmail: jest.Mock;
    createAdminUser: jest.Mock;
    createGuestAsUserTransaction: jest.Mock;
    createRegisteredPatient: jest.Mock;
    findPublicDoctors: jest.Mock;
    findPublicDoctorById: jest.Mock;
    findById: jest.Mock;
    update: jest.Mock;
  };
  let mockProfileRepository: {
    findGuestPatientByPhone: jest.Mock;
    findPatientProfilesWithPagination: jest.Mock;
    countTotalPatients: jest.Mock;
    countPatientsCreatedAfter: jest.Mock;
    updatePatientProfileTransaction: jest.Mock;
    createGuestPatientProfile: jest.Mock;
  };
  let mockBookingRepository: {
    countActiveAppointmentsGroup: jest.Mock;
  };
  let mockSequenceService: {
    generateNextSequence: jest.Mock;
  };
  let mockRedisService: {
    isReady: jest.Mock;
    getJson: jest.Mock;
    setJson: jest.Mock;
    delPattern: jest.Mock;
  };
  let mockMailService: {
    sendTemporaryPasswordEmail: jest.Mock;
  };

  beforeEach(async () => {
    mockUserRepository = {
      findByEmail: jest.fn(),
      findByPhone: jest.fn(),
      findByPhoneOrEmail: jest.fn(),
      createAdminUser: jest.fn(),
      createGuestAsUserTransaction: jest.fn(),
      createRegisteredPatient: jest.fn(),
      findPublicDoctors: jest.fn(),
      findPublicDoctorById: jest.fn(),
      findById: jest.fn(),
      update: jest.fn(),
    };

    mockProfileRepository = {
      findGuestPatientByPhone: jest.fn(),
      findPatientProfilesWithPagination: jest.fn(),
      countTotalPatients: jest.fn(),
      countPatientsCreatedAfter: jest.fn(),
      updatePatientProfileTransaction: jest.fn(),
      createGuestPatientProfile: jest.fn(),
    };

    mockBookingRepository = {
      countActiveAppointmentsGroup: jest.fn(),
    };

    mockSequenceService = {
      generateNextSequence: jest.fn(),
    };

    mockRedisService = {
      isReady: jest.fn().mockReturnValue(false),
      getJson: jest.fn(),
      setJson: jest.fn(),
      delPattern: jest.fn(),
    };

    mockMailService = {
      sendTemporaryPasswordEmail: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: 'IUserRepository',
          useValue: mockUserRepository,
        },
        {
          provide: 'IProfileRepository',
          useValue: mockProfileRepository,
        },
        {
          provide: 'IBookingRepository',
          useValue: mockBookingRepository,
        },
        {
          provide: SequenceService,
          useValue: mockSequenceService,
        },
        {
          provide: RedisService,
          useValue: mockRedisService,
        },
        {
          provide: MailService,
          useValue: mockMailService,
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  describe('create', () => {
    const createDto = {
      email: 'admin@test.com',
      password: 'password123',
      fullName: 'Admin User',
      phone: '0987654321',
      role: UserRole.ADMIN,
    };

    it('should throw ConflictException if email exists', async () => {
      mockUserRepository.findByEmail.mockResolvedValue({ id: 'u-1' });

      await expect(service.create(createDto)).rejects.toThrow(ApiException);
      expect(mockUserRepository.createAdminUser).not.toHaveBeenCalled();
    });

    it('should throw ConflictException if phone exists', async () => {
      mockUserRepository.findByEmail.mockResolvedValue(null);
      mockUserRepository.findByPhone.mockResolvedValue({ id: 'u-2' });

      await expect(service.create(createDto)).rejects.toThrow(ApiException);
    });

    it('should hash password and create admin user successfully', async () => {
      mockUserRepository.findByEmail.mockResolvedValue(null);
      mockUserRepository.findByPhone.mockResolvedValue(null);
      mockUserRepository.createAdminUser.mockResolvedValue({
        id: 'new-u-id',
        role: UserRole.ADMIN,
      });

      const result = await service.create(createDto);

      expect(result).toMatchObject({ id: 'new-u-id' });
      expect(mockUserRepository.createAdminUser).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'admin@test.com',
          role: UserRole.ADMIN,
        }),
        undefined,
      );
    });

    it('should create doctor profile when role is DOCTOR', async () => {
      mockUserRepository.findByEmail.mockResolvedValue(null);
      mockUserRepository.createAdminUser.mockResolvedValue({
        id: 'doc-1',
        role: UserRole.DOCTOR,
      });

      const docDto = {
        ...createDto,
        role: UserRole.DOCTOR,
        specialties: ['Cardiology'],
        consultationFee: 200000,
      };

      await service.create(docDto);

      expect(mockUserRepository.createAdminUser).toHaveBeenCalledWith(
        expect.any(Object) as unknown,
        expect.objectContaining({
          specialties: ['Cardiology'],
          consultationFee: 200000,
        }),
      );
    });
  });

  describe('registerPatient', () => {
    const registerDto = {
      fullName: 'Patient A',
      phone: '0123456789',
      email: 'patienta@test.com',
    };

    it('should return existing user immediately if phone/email is already registered', async () => {
      const existingUser = { id: 'u-1', fullName: 'Patient A' };
      mockUserRepository.findByPhoneOrEmail.mockResolvedValue(existingUser);

      const result = await service.registerPatient(registerDto);

      expect(result).toBe(existingUser);
      expect(mockUserRepository.createRegisteredPatient).not.toHaveBeenCalled();
    });

    it('should upgrade existing guest to user, generate temp password, and trigger email', async () => {
      mockUserRepository.findByPhoneOrEmail.mockResolvedValue(null);
      mockProfileRepository.findGuestPatientByPhone.mockResolvedValue({
        id: 'guest-profile-id',
        fullName: 'Patient A',
      });
      mockUserRepository.createGuestAsUserTransaction.mockResolvedValue({
        id: 'upgraded-u-id',
        fullName: 'Patient A',
      });

      const result = await service.registerPatient(registerDto);

      expect(result).toMatchObject({
        id: 'upgraded-u-id',
        tempPassword: expect.any(String) as string,
      });
      expect(
        mockUserRepository.createGuestAsUserTransaction,
      ).toHaveBeenCalledWith(
        'guest-profile-id',
        expect.any(Object) as unknown,
        expect.any(Object) as unknown,
      );
      // Wait briefly for the async mail send call to happen
      await new Promise((resolve) => setTimeout(resolve, 10));
      expect(mockMailService.sendTemporaryPasswordEmail).toHaveBeenCalledWith(
        'patienta@test.com',
        'Patient A',
        expect.any(String) as string,
      );
    });
  });

  describe('findPublicDoctors', () => {
    it('should read from redis cache if redis is ready and cache hit occurs', async () => {
      mockRedisService.isReady.mockReturnValue(true);
      const mockCachedData = {
        users: [{ id: 'd-1', fullName: 'Dr. Cache' }],
        pagination: {},
      };
      mockRedisService.getJson.mockResolvedValue(mockCachedData);

      const result = await service.findPublicDoctors({ serviceId: 'svc-1' });

      expect(result).toBe(mockCachedData);
      expect(mockUserRepository.findPublicDoctors).not.toHaveBeenCalled();
    });

    it('should query repository and cache it when cache misses', async () => {
      mockRedisService.isReady.mockReturnValue(true);
      mockRedisService.getJson.mockResolvedValue(null);
      const mockDbDoctors = [{ id: 'd-2', fullName: 'Dr. DB' }];
      mockUserRepository.findPublicDoctors.mockResolvedValue([
        mockDbDoctors,
        1,
      ]);

      const result = await service.findPublicDoctors({
        serviceId: 'svc-1',
        page: 1,
        limit: 10,
      });

      expect(result.users).toEqual(mockDbDoctors);
      expect(mockRedisService.setJson).toHaveBeenCalledWith(
        expect.stringContaining('cache:doctors:public:svc-1'),
        expect.any(Object) as unknown,
        7200,
      );
    });
  });
});
