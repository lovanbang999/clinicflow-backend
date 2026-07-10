import { Test, TestingModule } from '@nestjs/testing';
import { LabOrdersService } from './lab-orders.service';
import { I_CLINICAL_REPOSITORY } from '../database/interfaces/clinical.repository.interface';
import { I_BOOKING_REPOSITORY } from '../database/interfaces/booking.repository.interface';
import { I_PROFILE_REPOSITORY } from '../database/interfaces/profile.repository.interface';
import { I_USER_REPOSITORY } from '../database/interfaces/user.repository.interface';
import { LabOrdersGateway } from './lab-orders.gateway';
import { BillingService } from '../billing/billing.service';
import { MedicalRecordsService } from '../medical-records/medical-records.service';
import { ApiException } from '../../common/exceptions/api.exception';
import { LabOrderStatus, InvoiceStatus, UserRole, User } from '@prisma/client';

describe('LabOrdersService', () => {
  let service: LabOrdersService;
  let clinicalRepositoryMock: Record<string, jest.Mock>;
  let bookingRepositoryMock: Record<string, jest.Mock>;
  let profileRepositoryMock: Record<string, jest.Mock>;
  let userRepositoryMock: Record<string, jest.Mock>;
  let labOrdersGatewayMock: Record<string, jest.Mock>;
  let billingServiceMock: Record<string, jest.Mock>;
  let medicalRecordsServiceMock: Record<string, jest.Mock>;

  beforeEach(async () => {
    clinicalRepositoryMock = {
      findMedicalRecordByBookingId: jest.fn(),
      createMedicalRecordForBooking: jest.fn(),
      createLabOrderTransaction: jest.fn(),
      findLabOrdersByBookingId: jest.fn(),
      findPendingLabOrdersForBilling: jest.fn(),
      findPendingLabOrders: jest.fn(),
      findLabOrderWithRelations: jest.fn(),
      findRecentCompletedLabOrders: jest.fn(),
      findReadyToPerformLabOrders: jest.fn(),
      getTechnicianStats: jest.fn(),
      findTechnicianHistoryPaginated: jest.fn(),
      uploadLabResultTransaction: jest.fn(),
      updateLabOrderStatus: jest.fn(),
      findLabOrderForDeletion: jest.fn(),
      deleteLabOrderById: jest.fn(),
    };

    bookingRepositoryMock = {
      findBookingById: jest.fn(),
      hasTreatmentRelationship: jest.fn(),
    };

    profileRepositoryMock = {
      findPatientProfileByUserId: jest.fn(),
    };

    userRepositoryMock = {
      findTechnicianSpecializations: jest.fn(),
    };

    labOrdersGatewayMock = {
      broadcastLabResultCompleted: jest.fn(),
    };

    billingServiceMock = {
      syncLabInvoice: jest.fn().mockResolvedValue(undefined),
      removeInvoiceItem: jest.fn().mockResolvedValue(undefined),
    };

    medicalRecordsServiceMock = {
      checkAndAdvanceToResultsReady: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LabOrdersService,
        {
          provide: I_CLINICAL_REPOSITORY,
          useValue: clinicalRepositoryMock,
        },
        {
          provide: I_BOOKING_REPOSITORY,
          useValue: bookingRepositoryMock,
        },
        {
          provide: I_PROFILE_REPOSITORY,
          useValue: profileRepositoryMock,
        },
        {
          provide: I_USER_REPOSITORY,
          useValue: userRepositoryMock,
        },
        {
          provide: LabOrdersGateway,
          useValue: labOrdersGatewayMock,
        },
        {
          provide: BillingService,
          useValue: billingServiceMock,
        },
        {
          provide: MedicalRecordsService,
          useValue: medicalRecordsServiceMock,
        },
      ],
    }).compile();

    service = module.get<LabOrdersService>(LabOrdersService);
  });

  describe('createOrder', () => {
    const mockDto = {
      bookingId: 'booking-1',
      testName: 'Blood Test',
      testDescription: 'General test',
      serviceId: 'service-1',
    };

    it('should throw NOT_FOUND if booking not found', async () => {
      bookingRepositoryMock.findBookingById.mockResolvedValue(null);

      await expect(service.createOrder('doctor-1', mockDto)).rejects.toThrow(
        ApiException,
      );
    });

    it('should throw FORBIDDEN if user is DOCTOR but booking doctor does not match', async () => {
      bookingRepositoryMock.findBookingById.mockResolvedValue({
        id: 'booking-1',
        doctorId: 'doctor-2',
      });

      const currentUser = {
        id: 'doctor-1',
        role: UserRole.DOCTOR,
      } as Express.User;

      await expect(
        service.createOrder('doctor-2', mockDto, currentUser),
      ).rejects.toThrow(ApiException);
    });

    it('should create lab order successfully', async () => {
      bookingRepositoryMock.findBookingById.mockResolvedValue({
        id: 'booking-1',
        doctorId: 'doctor-1',
        patientProfileId: 'patient-1',
      });
      clinicalRepositoryMock.findMedicalRecordByBookingId.mockResolvedValue({
        id: 'mr-1',
        visitStep: 'EXAMINATION',
      });
      clinicalRepositoryMock.createLabOrderTransaction.mockResolvedValue({
        id: 'lab-order-1',
      });

      const result = await service.createOrder('doctor-1', mockDto);
      expect(result).toEqual({ id: 'lab-order-1' });
      expect(billingServiceMock.syncLabInvoice).toHaveBeenCalledWith(
        'booking-1',
      );
    });

    it('should create medical record if not exists, then create lab order', async () => {
      bookingRepositoryMock.findBookingById.mockResolvedValue({
        id: 'booking-1',
        doctorId: 'doctor-1',
        patientProfileId: 'patient-1',
      });
      clinicalRepositoryMock.findMedicalRecordByBookingId.mockResolvedValue(
        null,
      );
      clinicalRepositoryMock.createMedicalRecordForBooking.mockResolvedValue({
        id: 'mr-new',
        visitStep: null,
      });
      clinicalRepositoryMock.createLabOrderTransaction.mockResolvedValue({
        id: 'lab-order-1',
      });

      const result = await service.createOrder('doctor-1', mockDto);
      expect(result).toEqual({ id: 'lab-order-1' });
      expect(
        clinicalRepositoryMock.createMedicalRecordForBooking,
      ).toHaveBeenCalled();
    });
  });

  describe('getOrdersByBooking', () => {
    it('should throw NOT_FOUND if booking not found', async () => {
      bookingRepositoryMock.findBookingById.mockResolvedValue(null);

      await expect(service.getOrdersByBooking('booking-1')).rejects.toThrow(
        ApiException,
      );
    });

    it('should return list of orders', async () => {
      bookingRepositoryMock.findBookingById.mockResolvedValue({
        id: 'booking-1',
        patientProfileId: 'patient-1',
        doctorId: 'doctor-1',
      });
      clinicalRepositoryMock.findLabOrdersByBookingId.mockResolvedValue([
        { id: 'lab-1' },
      ]);

      const result = await service.getOrdersByBooking('booking-1');
      expect(result).toEqual([{ id: 'lab-1' }]);
    });
  });

  describe('validateLabOrderAccess', () => {
    it('should allow technician access', async () => {
      bookingRepositoryMock.findBookingById.mockResolvedValue({
        id: 'booking-1',
        patientProfileId: 'patient-1',
        doctorId: 'doctor-1',
      });
      clinicalRepositoryMock.findLabOrdersByBookingId.mockResolvedValue([]);

      const user = { id: 'tech-1', role: UserRole.TECHNICIAN } as Express.User;
      await expect(
        service.getOrdersByBooking('booking-1', user),
      ).resolves.toEqual([]);
    });

    it('should allow patient access to their own orders', async () => {
      bookingRepositoryMock.findBookingById.mockResolvedValue({
        id: 'booking-1',
        patientProfileId: 'patient-1',
        doctorId: 'doctor-1',
      });
      profileRepositoryMock.findPatientProfileByUserId.mockResolvedValue({
        id: 'patient-1',
      });
      clinicalRepositoryMock.findLabOrdersByBookingId.mockResolvedValue([]);

      const user = { id: 'user-1', role: UserRole.PATIENT } as Express.User;
      await expect(
        service.getOrdersByBooking('booking-1', user),
      ).resolves.toEqual([]);
    });

    it('should deny patient access to others orders', async () => {
      bookingRepositoryMock.findBookingById.mockResolvedValue({
        id: 'booking-1',
        patientProfileId: 'patient-1',
        doctorId: 'doctor-1',
      });
      profileRepositoryMock.findPatientProfileByUserId.mockResolvedValue({
        id: 'patient-2',
      });

      const user = { id: 'user-1', role: UserRole.PATIENT } as Express.User;
      await expect(
        service.getOrdersByBooking('booking-1', user),
      ).rejects.toThrow(ApiException);
    });

    it('should allow doctor with treatment relationship access', async () => {
      bookingRepositoryMock.findBookingById.mockResolvedValue({
        id: 'booking-1',
        patientProfileId: 'patient-1',
        doctorId: 'doctor-1',
      });
      bookingRepositoryMock.hasTreatmentRelationship.mockResolvedValue(true);
      clinicalRepositoryMock.findLabOrdersByBookingId.mockResolvedValue([]);

      const user = { id: 'doctor-2', role: UserRole.DOCTOR } as Express.User;
      await expect(
        service.getOrdersByBooking('booking-1', user),
      ).resolves.toEqual([]);
    });

    it('should deny doctor without treatment relationship access', async () => {
      bookingRepositoryMock.findBookingById.mockResolvedValue({
        id: 'booking-1',
        patientProfileId: 'patient-1',
        doctorId: 'doctor-1',
      });
      bookingRepositoryMock.hasTreatmentRelationship.mockResolvedValue(false);

      const user = { id: 'doctor-2', role: UserRole.DOCTOR } as Express.User;
      await expect(
        service.getOrdersByBooking('booking-1', user),
      ).rejects.toThrow(ApiException);
    });
  });

  describe('getPendingUnbilledOrders', () => {
    it('should return pending unbilled orders', async () => {
      bookingRepositoryMock.findBookingById.mockResolvedValue({
        id: 'booking-1',
        patientProfileId: 'patient-1',
        doctorId: 'doctor-1',
      });
      clinicalRepositoryMock.findPendingLabOrdersForBilling.mockResolvedValue([
        { id: 'lab-1' },
      ]);

      const result = await service.getPendingUnbilledOrders('booking-1');
      expect(result).toEqual([{ id: 'lab-1' }]);
    });
  });

  describe('getPendingOrders', () => {
    it('should return mapped pending orders', async () => {
      clinicalRepositoryMock.findPendingLabOrders.mockResolvedValue([
        {
          id: 'lab-1',
          booking: {
            bookingCode: 'BK-1',
            doctor: { fullName: 'Doc' },
            patientProfile: { fullName: 'Pat' },
          },
        },
      ]);

      const result = (await service.getPendingOrders()) as Array<{
        booking: { bookingCode: string };
      }>;
      expect(result[0].booking.bookingCode).toBe('BK-1');
    });
  });

  describe('getOrderById', () => {
    it('should throw NOT_FOUND if order not found', async () => {
      clinicalRepositoryMock.findLabOrderWithRelations.mockResolvedValue(null);

      await expect(service.getOrderById('lab-1')).rejects.toThrow(ApiException);
    });

    it('should return order detail with recent results', async () => {
      clinicalRepositoryMock.findLabOrderWithRelations.mockResolvedValue({
        id: 'lab-1',
        testName: 'Blood',
        patientProfileId: 'patient-1',
        booking: {
          bookingCode: 'BK-1',
          doctorId: 'doctor-1',
          doctor: {
            fullName: 'Doc',
            doctorProfile: { specialties: ['Cardiology'] },
          },
          patientProfile: { fullName: 'Pat' },
        },
      });
      clinicalRepositoryMock.findRecentCompletedLabOrders.mockResolvedValue([
        { id: 'lab-old' },
      ]);

      const result = await service.getOrderById('lab-1');
      expect(result.recentResults).toEqual([{ id: 'lab-old' }]);
      expect(result.booking?.doctor.specialties).toEqual(['Cardiology']);
    });
  });

  describe('getReadyToPerformOrders', () => {
    it('should fetch ready to perform orders using technician specialties', async () => {
      userRepositoryMock.findTechnicianSpecializations.mockResolvedValue([
        { categoryId: 'cat-1' },
      ]);
      clinicalRepositoryMock.findReadyToPerformLabOrders.mockResolvedValue([
        { id: 'lab-1', booking: { bookingCode: 'BK-1', doctor: {} } },
      ]);

      const user = { id: 'tech-1', role: UserRole.TECHNICIAN } as Express.User;
      const result = await service.getReadyToPerformOrders(user);
      expect(result.length).toBe(1);
      expect(
        userRepositoryMock.findTechnicianSpecializations,
      ).toHaveBeenCalledWith('tech-1');
    });
  });

  describe('getTechnicianStats & History', () => {
    it('should get stats', async () => {
      clinicalRepositoryMock.getTechnicianStats.mockResolvedValue({ count: 5 });
      const result = await service.getTechnicianStats();
      expect(result).toEqual({ count: 5 });
    });

    it('should get history with pagination', async () => {
      clinicalRepositoryMock.findTechnicianHistoryPaginated.mockResolvedValue([
        [{ id: 'lab-1', booking: { bookingCode: 'BK-1', doctor: {} } }],
        1,
      ]);

      const result = await service.getTechnicianHistory(
        { id: 'tech-1', role: UserRole.TECHNICIAN } as unknown as User,
        { page: 1, limit: 10 },
      );
      expect(result.items.length).toBe(1);
      expect(result.total).toBe(1);
      expect(result.pages).toBe(1);
    });
  });

  describe('addResult', () => {
    const uploadDto = {
      resultText: 'All good',
      resultFileUrl: 'url',
      isAbnormal: false,
    };

    it('should throw FORBIDDEN if not technician or admin', async () => {
      const user = { id: 'patient-1', role: UserRole.PATIENT } as Express.User;
      await expect(
        service.addResult('patient-1', 'lab-1', uploadDto, user),
      ).rejects.toThrow(ApiException);
    });

    it('should throw NOT_FOUND if order not found', async () => {
      const user = { id: 'tech-1', role: UserRole.TECHNICIAN } as Express.User;
      clinicalRepositoryMock.findLabOrderWithRelations.mockResolvedValue(null);

      await expect(
        service.addResult('tech-1', 'lab-1', uploadDto, user),
      ).rejects.toThrow(ApiException);
    });

    it('should upload result and advance medical record step', async () => {
      const user = { id: 'tech-1', role: UserRole.TECHNICIAN } as Express.User;
      clinicalRepositoryMock.findLabOrderWithRelations.mockResolvedValue({
        id: 'lab-1',
        bookingId: 'booking-1',
        testName: 'Blood',
        medicalRecordId: 'mr-1',
      });
      clinicalRepositoryMock.uploadLabResultTransaction.mockResolvedValue({
        id: 'lab-1',
        status: LabOrderStatus.COMPLETED,
      });

      const result = await service.addResult(
        'tech-1',
        'lab-1',
        uploadDto,
        user,
      );
      expect(result.status).toBe(LabOrderStatus.COMPLETED);
      expect(
        labOrdersGatewayMock.broadcastLabResultCompleted,
      ).toHaveBeenCalled();
      expect(
        medicalRecordsServiceMock.checkAndAdvanceToResultsReady,
      ).toHaveBeenCalledWith('mr-1');
    });
  });

  describe('updateStatus', () => {
    it('should throw FORBIDDEN if not receptionist, technician or admin', async () => {
      const user = {
        id: 'patient-1',
        role: UserRole.PATIENT,
      } as unknown as User;
      await expect(
        service.updateStatus('lab-1', LabOrderStatus.IN_PROGRESS, user),
      ).rejects.toThrow(ApiException);
    });

    it('should throw PAYMENT_REQUIRED if trying to mark unpaid order to IN_PROGRESS', async () => {
      const user = {
        id: 'tech-1',
        role: UserRole.TECHNICIAN,
      } as unknown as User;
      clinicalRepositoryMock.findLabOrderWithRelations.mockResolvedValue({
        id: 'lab-1',
        status: LabOrderStatus.PENDING, // PENDING is unpaid
      });

      await expect(
        service.updateStatus('lab-1', LabOrderStatus.IN_PROGRESS, user),
      ).rejects.toThrow(ApiException);
    });

    it('should successfully update status', async () => {
      const user = {
        id: 'tech-1',
        role: UserRole.TECHNICIAN,
      } as unknown as User;
      clinicalRepositoryMock.findLabOrderWithRelations.mockResolvedValue({
        id: 'lab-1',
        status: LabOrderStatus.PAID,
        medicalRecordId: 'mr-1',
      });
      clinicalRepositoryMock.updateLabOrderStatus.mockResolvedValue({
        id: 'lab-1',
        status: LabOrderStatus.COMPLETED,
      });

      const result = (await service.updateStatus(
        'lab-1',
        LabOrderStatus.COMPLETED,
        user,
      )) as { status: LabOrderStatus };
      expect(result.status).toBe(LabOrderStatus.COMPLETED);
      expect(
        medicalRecordsServiceMock.checkAndAdvanceToResultsReady,
      ).toHaveBeenCalledWith('mr-1');
    });
  });

  describe('deleteOrder', () => {
    it('should throw NOT_FOUND if order not found', async () => {
      clinicalRepositoryMock.findLabOrderForDeletion.mockResolvedValue(null);

      await expect(service.deleteOrder('doctor-1', 'lab-1')).rejects.toThrow(
        ApiException,
      );
    });

    it('should throw FORBIDDEN if doctor is not the creator', async () => {
      clinicalRepositoryMock.findLabOrderForDeletion.mockResolvedValue({
        id: 'lab-1',
        doctorId: 'doctor-2',
      });

      const user = { id: 'doctor-1', role: UserRole.DOCTOR } as Express.User;
      await expect(
        service.deleteOrder('doctor-1', 'lab-1', user),
      ).rejects.toThrow(ApiException);
    });

    it('should throw BAD_REQUEST if order status is COMPLETED', async () => {
      clinicalRepositoryMock.findLabOrderForDeletion.mockResolvedValue({
        id: 'lab-1',
        doctorId: 'doctor-1',
        status: LabOrderStatus.COMPLETED,
      });

      await expect(service.deleteOrder('doctor-1', 'lab-1')).rejects.toThrow(
        ApiException,
      );
    });

    it('should throw CONFLICT if invoice status is not DRAFT', async () => {
      clinicalRepositoryMock.findLabOrderForDeletion.mockResolvedValue({
        id: 'lab-1',
        doctorId: 'doctor-1',
        status: LabOrderStatus.PENDING,
        invoiceItem: {
          invoice: {
            status: InvoiceStatus.PAID,
          },
        },
      });

      await expect(service.deleteOrder('doctor-1', 'lab-1')).rejects.toThrow(
        ApiException,
      );
    });

    it('should delete order successfully', async () => {
      clinicalRepositoryMock.findLabOrderForDeletion.mockResolvedValue({
        id: 'lab-1',
        doctorId: 'doctor-1',
        status: LabOrderStatus.PENDING,
        bookingId: 'booking-1',
        medicalRecordId: 'mr-1',
        invoiceItem: {
          id: 'item-1',
          invoiceId: 'inv-1',
          invoice: {
            status: InvoiceStatus.DRAFT,
          },
        },
      });

      const result = await service.deleteOrder('doctor-1', 'lab-1');
      expect(result).toBeNull();
      expect(billingServiceMock.removeInvoiceItem).toHaveBeenCalledWith(
        'inv-1',
        'item-1',
      );
      expect(clinicalRepositoryMock.deleteLabOrderById).toHaveBeenCalledWith(
        'lab-1',
      );
      expect(billingServiceMock.syncLabInvoice).toHaveBeenCalledWith(
        'booking-1',
      );
      expect(
        medicalRecordsServiceMock.checkAndAdvanceToResultsReady,
      ).toHaveBeenCalledWith('mr-1');
    });
  });
});
