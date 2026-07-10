import { Test, TestingModule } from '@nestjs/testing';
import { AdminSchedulesService } from './admin-schedules.service';
import { I_BOOKING_REPOSITORY } from '../../database/interfaces/booking.repository.interface';
import { I_USER_REPOSITORY } from '../../database/interfaces/user.repository.interface';
import { I_CATALOG_REPOSITORY } from '../../database/interfaces/catalog.repository.interface';
import { ApiException } from '../../../common/exceptions/api.exception';

describe('AdminSchedulesService', () => {
  let service: AdminSchedulesService;
  let bookingRepositoryMock: Record<string, jest.Mock>;
  let userRepositoryMock: Record<string, jest.Mock>;
  let catalogRepositoryMock: Record<string, jest.Mock>;

  beforeEach(async () => {
    bookingRepositoryMock = {
      getScheduleDashboardStats: jest.fn(),
      findAdminScheduleSlots: jest.fn(),
      findAdminScheduleSlotDetail: jest.fn(),
      createScheduleSlot: jest.fn(),
      updateScheduleSlot: jest.fn(),
    };

    userRepositoryMock = {
      findDoctorWithProfile: jest.fn(),
    };

    catalogRepositoryMock = {
      findActiveRooms: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminSchedulesService,
        { provide: I_BOOKING_REPOSITORY, useValue: bookingRepositoryMock },
        { provide: I_USER_REPOSITORY, useValue: userRepositoryMock },
        { provide: I_CATALOG_REPOSITORY, useValue: catalogRepositoryMock },
      ],
    }).compile();

    service = module.get<AdminSchedulesService>(AdminSchedulesService);
  });

  describe('getRooms', () => {
    it('should query CatalogRepository findActiveRooms', async () => {
      catalogRepositoryMock.findActiveRooms.mockResolvedValue([
        { id: 'room-1', name: 'Room A' },
      ]);

      const result = await service.getRooms();

      expect(catalogRepositoryMock.findActiveRooms).toHaveBeenCalled();
      expect(result.length).toBe(1);
      expect(result[0].name).toBe('Room A');
    });
  });

  describe('getStatistics', () => {
    it('should query BookingRepository getScheduleDashboardStats', async () => {
      const statsMock = { totalSlots: 10, occupiedSlots: 6 };
      bookingRepositoryMock.getScheduleDashboardStats.mockResolvedValue(
        statsMock,
      );

      const result = await service.getStatistics();

      expect(
        bookingRepositoryMock.getScheduleDashboardStats,
      ).toHaveBeenCalled();
      expect(result).toEqual(statsMock);
    });
  });

  describe('findAll', () => {
    it('should query BookingRepository findAdminScheduleSlots', async () => {
      bookingRepositoryMock.findAdminScheduleSlots.mockResolvedValue([
        { id: 'slot-1' },
      ]);

      const result = await service.findAll({ doctorId: 'doc-1' });

      expect(bookingRepositoryMock.findAdminScheduleSlots).toHaveBeenCalled();
      expect(result.data.length).toBe(1);
      expect(result.meta.total).toBe(1);
    });
  });

  describe('findOne', () => {
    it('should return slot detail if exists', async () => {
      bookingRepositoryMock.findAdminScheduleSlotDetail.mockResolvedValue({
        id: 'slot-1',
      });

      const result = await service.findOne('slot-1');

      expect(
        bookingRepositoryMock.findAdminScheduleSlotDetail,
      ).toHaveBeenCalledWith('slot-1');
      expect(result).toBeDefined();
    });

    it('should throw SCHEDULE_NOT_FOUND if slot not found', async () => {
      bookingRepositoryMock.findAdminScheduleSlotDetail.mockResolvedValue(null);

      await expect(service.findOne('slot-1')).rejects.toThrow(ApiException);
    });
  });

  describe('create', () => {
    const createDto = {
      doctorId: 'doc-1',
      roomId: 'room-1',
      date: '2026-07-15T08:00:00.000Z',
      startTime: '08:00',
      endTime: '12:00',
      maxPatients: 10,
    };

    it('should throw USER_NOT_FOUND if doctor not found', async () => {
      userRepositoryMock.findDoctorWithProfile.mockResolvedValue(null);

      await expect(service.create(createDto)).rejects.toThrow(ApiException);
    });

    it('should create slot using specified room', async () => {
      userRepositoryMock.findDoctorWithProfile.mockResolvedValue({
        id: 'doc-1',
        doctorProfile: { roomId: 'room-default' },
      });
      bookingRepositoryMock.createScheduleSlot.mockResolvedValue({
        id: 'slot-1',
      });

      const result = await service.create(createDto);

      expect(bookingRepositoryMock.createScheduleSlot).toHaveBeenCalledWith(
        expect.objectContaining({ roomId: 'room-1' }),
      );
      expect(result).toBeDefined();
    });

    it('should fall back to doctor profile roomId if no roomId is specified', async () => {
      userRepositoryMock.findDoctorWithProfile.mockResolvedValue({
        id: 'doc-1',
        doctorProfile: { roomId: 'room-default' },
      });
      bookingRepositoryMock.createScheduleSlot.mockResolvedValue({
        id: 'slot-1',
      });

      await service.create({ ...createDto, roomId: undefined });

      expect(bookingRepositoryMock.createScheduleSlot).toHaveBeenCalledWith(
        expect.objectContaining({ roomId: 'room-default' }),
      );
    });
  });

  describe('update', () => {
    it('should throw SCHEDULE_NOT_FOUND if slot does not exist', async () => {
      bookingRepositoryMock.findAdminScheduleSlotDetail.mockResolvedValue(null);

      await expect(
        service.update('slot-1', { maxPatients: 5 }),
      ).rejects.toThrow(ApiException);
    });

    it('should update slot successfully if exists', async () => {
      bookingRepositoryMock.findAdminScheduleSlotDetail.mockResolvedValue({
        id: 'slot-1',
      });
      bookingRepositoryMock.updateScheduleSlot.mockResolvedValue({
        id: 'slot-1',
        maxPatients: 5,
      });

      const result = await service.update('slot-1', { maxPatients: 5 });

      expect(bookingRepositoryMock.updateScheduleSlot).toHaveBeenCalled();
      expect(result.maxPatients).toBe(5);
    });
  });

  describe('remove', () => {
    it('should throw SCHEDULE_NOT_FOUND if slot does not exist', async () => {
      bookingRepositoryMock.findAdminScheduleSlotDetail.mockResolvedValue(null);

      await expect(service.remove('slot-1')).rejects.toThrow(ApiException);
    });

    it('should soft-delete slot by setting isActive to false', async () => {
      bookingRepositoryMock.findAdminScheduleSlotDetail.mockResolvedValue({
        id: 'slot-1',
      });
      bookingRepositoryMock.updateScheduleSlot.mockResolvedValue({
        id: 'slot-1',
        isActive: false,
      });

      const result = await service.remove('slot-1');

      expect(bookingRepositoryMock.updateScheduleSlot).toHaveBeenCalledWith(
        'slot-1',
        { isActive: false },
      );
      expect(result.isActive).toBe(false);
    });
  });

  describe('restore', () => {
    it('should throw SCHEDULE_NOT_FOUND if slot does not exist', async () => {
      bookingRepositoryMock.findAdminScheduleSlotDetail.mockResolvedValue(null);

      await expect(service.restore('slot-1')).rejects.toThrow(ApiException);
    });

    it('should restore slot by setting isActive to true', async () => {
      bookingRepositoryMock.findAdminScheduleSlotDetail.mockResolvedValue({
        id: 'slot-1',
      });
      bookingRepositoryMock.updateScheduleSlot.mockResolvedValue({
        id: 'slot-1',
        isActive: true,
      });

      const result = await service.restore('slot-1');

      expect(bookingRepositoryMock.updateScheduleSlot).toHaveBeenCalledWith(
        'slot-1',
        { isActive: true },
      );
      expect(result.isActive).toBe(true);
    });
  });
});
