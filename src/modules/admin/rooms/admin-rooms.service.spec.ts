import { Test, TestingModule } from '@nestjs/testing';
import { AdminRoomsService } from './admin-rooms.service';
import { I_CATALOG_REPOSITORY } from '../../database/interfaces/catalog.repository.interface';
import { I_BOOKING_REPOSITORY } from '../../database/interfaces/booking.repository.interface';
import { ApiException } from '../../../common/exceptions/api.exception';
import { RoomType } from '@prisma/client';

describe('AdminRoomsService', () => {
  let service: AdminRoomsService;
  let catalogRepositoryMock: Record<string, jest.Mock>;
  let bookingRepositoryMock: Record<string, jest.Mock>;

  beforeEach(async () => {
    catalogRepositoryMock = {
      findAdminRoomsPage: jest.fn(),
      findAdminRoomDetailById: jest.fn(),
      findRoomByName: jest.fn(),
      createRoom: jest.fn(),
      updateRoom: jest.fn(),
    };

    bookingRepositoryMock = {
      countActiveScheduleSlotsForRoom: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminRoomsService,
        { provide: I_CATALOG_REPOSITORY, useValue: catalogRepositoryMock },
        { provide: I_BOOKING_REPOSITORY, useValue: bookingRepositoryMock },
      ],
    }).compile();

    service = module.get<AdminRoomsService>(AdminRoomsService);
  });

  describe('findAll', () => {
    it('should query CatalogRepository findAdminRoomsPage', async () => {
      catalogRepositoryMock.findAdminRoomsPage.mockResolvedValue([
        [{ id: 'room-1', name: 'Room 101' }],
        1,
      ]);

      const result = await service.findAll({ isActive: true, search: '101' });

      expect(catalogRepositoryMock.findAdminRoomsPage).toHaveBeenCalled();
      expect(result.rooms.length).toBe(1);
      expect(result.pagination.total).toBe(1);
    });

    it('should query CatalogRepository with falsy isActive string parsed correctly', async () => {
      catalogRepositoryMock.findAdminRoomsPage.mockResolvedValue([[], 0]);

      await service.findAll({ isActive: 'false' as unknown as boolean });

      expect(catalogRepositoryMock.findAdminRoomsPage).toHaveBeenCalledWith(
        expect.objectContaining({ isActive: false }),
        expect.any(Number),
        expect.any(Number),
      );
    });
  });

  describe('findOne', () => {
    it('should return room detail if exists', async () => {
      catalogRepositoryMock.findAdminRoomDetailById.mockResolvedValue({
        id: 'room-1',
        name: 'Room 101',
      });

      const result = await service.findOne('room-1');

      expect(
        catalogRepositoryMock.findAdminRoomDetailById,
      ).toHaveBeenCalledWith('room-1');
      expect(result.name).toBe('Room 101');
    });

    it('should throw ROOM_NOT_FOUND if room not found', async () => {
      catalogRepositoryMock.findAdminRoomDetailById.mockResolvedValue(null);

      await expect(service.findOne('room-1')).rejects.toThrow(ApiException);
    });
  });

  describe('create', () => {
    const dto = {
      name: 'Room 101',
      type: RoomType.CONSULTATION,
      floor: '1',
      capacity: 2,
      notes: 'No notes',
    };

    it('should throw ROOM_NAME_EXISTS if room name exists', async () => {
      catalogRepositoryMock.findRoomByName.mockResolvedValue({
        id: 'room-existing',
      });

      await expect(service.create(dto)).rejects.toThrow(ApiException);
    });

    it('should create room successfully if name is unique', async () => {
      catalogRepositoryMock.findRoomByName.mockResolvedValue(null);
      catalogRepositoryMock.createRoom.mockResolvedValue({
        id: 'room-1',
        name: dto.name,
      });

      const result = await service.create(dto);

      expect(catalogRepositoryMock.createRoom).toHaveBeenCalled();
      expect(result.name).toBe(dto.name);
    });
  });

  describe('update', () => {
    const dto = {
      name: 'Room 101 Updated',
      floor: '2',
    };

    it('should throw ROOM_NOT_FOUND if room does not exist', async () => {
      catalogRepositoryMock.findAdminRoomDetailById.mockResolvedValue(null);

      await expect(service.update('room-1', dto)).rejects.toThrow(ApiException);
    });

    it('should throw ROOM_NAME_EXISTS if name already exists on another room', async () => {
      catalogRepositoryMock.findAdminRoomDetailById.mockResolvedValue({
        id: 'room-1',
        name: 'Room 101',
      });
      catalogRepositoryMock.findRoomByName.mockResolvedValue({
        id: 'room-other',
      });

      await expect(service.update('room-1', dto)).rejects.toThrow(ApiException);
    });

    it('should update room successfully', async () => {
      catalogRepositoryMock.findAdminRoomDetailById.mockResolvedValue({
        id: 'room-1',
        name: 'Room 101',
      });
      catalogRepositoryMock.findRoomByName.mockResolvedValue(null);
      catalogRepositoryMock.updateRoom.mockResolvedValue({
        id: 'room-1',
        name: dto.name,
      });

      const result = await service.update('room-1', dto);

      expect(catalogRepositoryMock.updateRoom).toHaveBeenCalled();
      expect(result.name).toBe(dto.name);
    });
  });

  describe('remove', () => {
    it('should throw ROOM_NOT_FOUND if room does not exist', async () => {
      catalogRepositoryMock.findAdminRoomDetailById.mockResolvedValue(null);

      await expect(service.remove('room-1')).rejects.toThrow(ApiException);
    });

    it('should throw ROOM_HAS_ACTIVE_SLOTS if room has upcoming schedule slots', async () => {
      catalogRepositoryMock.findAdminRoomDetailById.mockResolvedValue({
        id: 'room-1',
      });
      bookingRepositoryMock.countActiveScheduleSlotsForRoom.mockResolvedValue(
        3,
      );

      await expect(service.remove('room-1')).rejects.toThrow(ApiException);
    });

    it('should deactivate room by setting isActive to false if no schedule slots exist', async () => {
      catalogRepositoryMock.findAdminRoomDetailById.mockResolvedValue({
        id: 'room-1',
      });
      bookingRepositoryMock.countActiveScheduleSlotsForRoom.mockResolvedValue(
        0,
      );
      catalogRepositoryMock.updateRoom.mockResolvedValue({
        id: 'room-1',
        isActive: false,
      });

      const result = await service.remove('room-1');

      expect(catalogRepositoryMock.updateRoom).toHaveBeenCalledWith('room-1', {
        isActive: false,
      });
      expect(result.isActive).toBe(false);
    });
  });

  describe('restore', () => {
    it('should throw ROOM_NOT_FOUND if room does not exist', async () => {
      catalogRepositoryMock.findAdminRoomDetailById.mockResolvedValue(null);

      await expect(service.restore('room-1')).rejects.toThrow(ApiException);
    });

    it('should throw ROOM_ALREADY_ACTIVE if room is already active', async () => {
      catalogRepositoryMock.findAdminRoomDetailById.mockResolvedValue({
        id: 'room-1',
        isActive: true,
      });

      await expect(service.restore('room-1')).rejects.toThrow(ApiException);
    });

    it('should activate room by setting isActive to true', async () => {
      catalogRepositoryMock.findAdminRoomDetailById.mockResolvedValue({
        id: 'room-1',
        isActive: false,
      });
      catalogRepositoryMock.updateRoom.mockResolvedValue({
        id: 'room-1',
        isActive: true,
      });

      const result = await service.restore('room-1');

      expect(catalogRepositoryMock.updateRoom).toHaveBeenCalledWith('room-1', {
        isActive: true,
      });
      expect(result.isActive).toBe(true);
    });
  });
});
