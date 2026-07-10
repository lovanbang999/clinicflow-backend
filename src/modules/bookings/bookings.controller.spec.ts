import { Test, TestingModule } from '@nestjs/testing';
import { BookingsController } from './bookings.controller';
import { BookingsService } from './bookings.service';
import {
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { CreateBookingDto } from './dto/create-booking.dto';
import { CreateDirectServiceBookingDto } from './dto/create-direct-service-booking.dto';
import { UpdateBookingStatusDto } from './dto/update-booking-status.dto';
import { FilterBookingDto } from './dto/filter-booking.dto';
import { CancelBookingDto } from './dto/cancel-booking.dto';
import { UpdateBookingServiceDto } from './dto/update-booking-service.dto';
import { User, UserRole } from '@prisma/client';

describe('BookingsController', () => {
  let controller: BookingsController;
  let serviceMock: Record<string, jest.Mock>;

  const mockUser = {
    id: 'u-1',
    email: 'test@example.com',
    role: UserRole.PATIENT,
  } as unknown as User;

  beforeEach(async () => {
    serviceMock = {
      create: jest.fn(),
      createByReceptionist: jest.fn(),
      createDirectServiceBooking: jest.fn(),
      assignSpecialistService: jest.fn(),
      findMyPatients: jest.fn(),
      findAll: jest.fn(),
      findMyBookings: jest.fn(),
      findOne: jest.fn(),
      checkIn: jest.fn(),
      updateStatus: jest.fn(),
      startExamination: jest.fn(),
      completeVisit: jest.fn(),
      markNoShow: jest.fn(),
      cancelBooking: jest.fn(),
      remove: jest.fn(),
      getPatientDashboardStats: jest.fn(),
      getReceptionistDashboardStats: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [BookingsController],
      providers: [
        {
          provide: BookingsService,
          useValue: serviceMock,
        },
      ],
    }).compile();

    controller = module.get<BookingsController>(BookingsController);
  });

  it('create should delegate to bookingsService.create with dto and userId', async () => {
    const dto: CreateBookingDto = {
      patientProfileId: 'p-1',
      doctorId: 'd-1',
      serviceId: 's-1',
      bookingDate: '2028-12-01',
      startTime: '09:00',
    };
    serviceMock.create.mockResolvedValue({ id: 'b-1' });
    const result = await controller.create(dto, 'u-1');
    expect(result).toEqual({ id: 'b-1' });
    expect(serviceMock.create).toHaveBeenCalledWith(dto, 'u-1');
  });

  it('createByReceptionist should delegate to bookingsService.createByReceptionist', async () => {
    const dto: CreateBookingDto = {
      patientProfileId: 'p-1',
      doctorId: 'd-1',
      serviceId: 's-1',
      bookingDate: '2028-12-01',
      startTime: '09:00',
    };
    serviceMock.createByReceptionist.mockResolvedValue({ id: 'b-1' });
    const result = await controller.createByReceptionist(dto, 'u-2');
    expect(result).toEqual({ id: 'b-1' });
    expect(serviceMock.createByReceptionist).toHaveBeenCalledWith(dto, 'u-2');
  });

  it('createDirectServiceBooking should delegate to bookingsService.createDirectServiceBooking', async () => {
    const dto: CreateDirectServiceBookingDto = {
      patientProfileId: 'p-1',
      doctorId: 'd-1',
      serviceIds: ['s-1'],
      bookingDate: '2028-12-01',
    };
    serviceMock.createDirectServiceBooking.mockResolvedValue({ id: 'b-1' });
    const result = await controller.createDirectServiceBooking(dto, 'u-2');
    expect(result).toEqual({ id: 'b-1' });
    expect(serviceMock.createDirectServiceBooking).toHaveBeenCalledWith(
      dto,
      'u-2',
    );
  });

  it('updateService should delegate to bookingsService.assignSpecialistService', async () => {
    const dto: UpdateBookingServiceDto = {
      serviceId: 's-2',
      newDoctorId: 'd-2',
    };
    serviceMock.assignSpecialistService.mockResolvedValue({ success: true });
    const result = await controller.updateService('b-1', dto, mockUser);
    expect(result).toEqual({ success: true });
    expect(serviceMock.assignSpecialistService).toHaveBeenCalledWith(
      'b-1',
      's-2',
      'u-1',
      'd-2',
    );
  });

  it('getMyPatients should delegate to bookingsService.findMyPatients', async () => {
    serviceMock.findMyPatients.mockResolvedValue([]);
    const result = await controller.getMyPatients(mockUser, 'test', '1', '20');
    expect(result).toEqual([]);
    expect(serviceMock.findMyPatients).toHaveBeenCalledWith('u-1', {
      search: 'test',
      page: 1,
      limit: 20,
      currentUser: mockUser,
    });
  });

  it('findAll should delegate to bookingsService.findAll with query', async () => {
    const query: FilterBookingDto = { page: 1, limit: 10 };
    serviceMock.findAll.mockResolvedValue([]);
    const result = await controller.findAll(query);
    expect(result).toEqual([]);
    expect(serviceMock.findAll).toHaveBeenCalledWith(query);
  });

  it('getMyBookings should delegate to bookingsService.findMyBookings', async () => {
    serviceMock.findMyBookings.mockResolvedValue([]);
    const result = await controller.getMyBookings(
      'CONFIRMED',
      '2',
      '5',
      mockUser,
    );
    expect(result).toEqual([]);
    expect(serviceMock.findMyBookings).toHaveBeenCalledWith('u-1', {
      status: 'CONFIRMED',
      page: 2,
      limit: 5,
    });
  });

  it('findOne should delegate to bookingsService.findOne with id and user', async () => {
    serviceMock.findOne.mockResolvedValue({ id: 'b-1' });
    const result = await controller.findOne('b-1', mockUser);
    expect(result).toEqual({ id: 'b-1' });
    expect(serviceMock.findOne).toHaveBeenCalledWith('b-1', mockUser);
  });

  it('checkIn should delegate to bookingsService.checkIn with id and userId', async () => {
    serviceMock.checkIn.mockResolvedValue({ success: true });
    const result = await controller.checkIn('b-1', mockUser);
    expect(result).toEqual({ success: true });
    expect(serviceMock.checkIn).toHaveBeenCalledWith('b-1', 'u-1');
  });

  it('updateStatus should delegate to bookingsService.updateStatus', async () => {
    const dto: UpdateBookingStatusDto = { status: 'CHECKED_IN' };
    serviceMock.updateStatus.mockResolvedValue({ success: true });
    const result = await controller.updateStatus('b-1', dto, mockUser);
    expect(result).toEqual({ success: true });
    expect(serviceMock.updateStatus).toHaveBeenCalledWith(
      'b-1',
      dto,
      'u-1',
      mockUser,
    );
  });

  it('startExamination should delegate to bookingsService.startExamination', async () => {
    serviceMock.startExamination.mockResolvedValue({ success: true });
    const result = await controller.startExamination('b-1', mockUser);
    expect(result).toEqual({ success: true });
    expect(serviceMock.startExamination).toHaveBeenCalledWith(
      'b-1',
      'u-1',
      mockUser,
    );
  });

  it('completeVisit should delegate to bookingsService.completeVisit', async () => {
    serviceMock.completeVisit.mockResolvedValue({ success: true });
    const result = await controller.completeVisit(
      'b-1',
      'some notes',
      mockUser,
    );
    expect(result).toEqual({ success: true });
    expect(serviceMock.completeVisit).toHaveBeenCalledWith(
      'b-1',
      'u-1',
      'some notes',
      mockUser,
    );
  });

  it('markNoShow should delegate to bookingsService.markNoShow', async () => {
    serviceMock.markNoShow.mockResolvedValue({ success: true });
    const result = await controller.markNoShow('b-1', mockUser);
    expect(result).toEqual({ success: true });
    expect(serviceMock.markNoShow).toHaveBeenCalledWith('b-1', 'u-1', mockUser);
  });

  it('cancelBooking should delegate to bookingsService.cancelBooking', async () => {
    const dto: CancelBookingDto = { reason: 'feeling better' };
    serviceMock.cancelBooking.mockResolvedValue({ success: true });
    const result = await controller.cancelBooking('b-1', dto, mockUser);
    expect(result).toEqual({ success: true });
    expect(serviceMock.cancelBooking).toHaveBeenCalledWith(
      'b-1',
      'u-1',
      'feeling better',
      mockUser,
    );
  });

  it('remove should delegate to bookingsService.remove', async () => {
    serviceMock.remove.mockResolvedValue({ success: true });
    const result = await controller.remove('b-1', 'u-1');
    expect(result).toEqual({ success: true });
    expect(serviceMock.remove).toHaveBeenCalledWith('b-1', 'u-1');
  });

  it('getPatientDashboardStats should delegate to bookingsService.getPatientDashboardStats', async () => {
    serviceMock.getPatientDashboardStats.mockResolvedValue({});
    const result = await controller.getPatientDashboardStats('u-1');
    expect(result).toEqual({});
    expect(serviceMock.getPatientDashboardStats).toHaveBeenCalledWith('u-1');
  });

  it('getReceptionistDashboardStats should delegate to bookingsService.getReceptionistDashboardStats', async () => {
    serviceMock.getReceptionistDashboardStats.mockResolvedValue({});
    const result = await controller.getReceptionistDashboardStats();
    expect(result).toEqual({});
    expect(serviceMock.getReceptionistDashboardStats).toHaveBeenCalled();
  });

  it('should propagate NotFoundException from findOne service', async () => {
    serviceMock.findOne.mockRejectedValue(
      new NotFoundException('Booking not found'),
    );
    await expect(controller.findOne('non-existent', mockUser)).rejects.toThrow(
      NotFoundException,
    );
  });

  it('should propagate ConflictException from create service', async () => {
    const dto: CreateBookingDto = {
      patientProfileId: 'p-1',
      doctorId: 'd-1',
      serviceId: 's-1',
      bookingDate: '2028-12-01',
      startTime: '09:00',
    };
    serviceMock.create.mockRejectedValue(new ConflictException('Slot taken'));
    await expect(controller.create(dto, 'u-1')).rejects.toThrow(
      ConflictException,
    );
  });

  it('should propagate BadRequestException from checkIn service', async () => {
    serviceMock.checkIn.mockRejectedValue(
      new BadRequestException('Cannot check in'),
    );
    await expect(controller.checkIn('b-1', mockUser)).rejects.toThrow(
      BadRequestException,
    );
  });
});
