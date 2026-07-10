import { Test, TestingModule } from '@nestjs/testing';
import { BillingService } from './billing.service';
import { I_FINANCE_REPOSITORY } from '../database/interfaces/finance.repository.interface';
import { I_BOOKING_REPOSITORY } from '../database/interfaces/booking.repository.interface';
import { I_PROFILE_REPOSITORY } from '../database/interfaces/profile.repository.interface';
import { I_CLINICAL_REPOSITORY } from '../database/interfaces/clinical.repository.interface';
import { NotificationsService } from '../notifications/notifications.service';
import { LabOrdersGateway } from '../lab-orders/lab-orders.gateway';
import { QueueGateway } from '../queue/queue.gateway';
import { QueueService } from '../queue/queue.service';
import { SequenceService } from '../database/services/sequence.service';
import { ApiException } from '../../common/exceptions/api.exception';
import { HttpStatus } from '@nestjs/common';
import { MessageCodes } from '../../common/constants/message-codes.const';
import {
  InvoiceStatus,
  InvoiceType,
  PaymentMethod,
  BookingStatus,
  VisitStep,
} from '@prisma/client';

describe('BillingService', () => {
  let service: BillingService;
  let financeRepositoryMock: Record<string, jest.Mock>;
  let bookingRepositoryMock: Record<string, jest.Mock>;
  let profileRepositoryMock: Record<string, jest.Mock>;
  let clinicalRepositoryMock: Record<string, jest.Mock>;
  let notificationsServiceMock: Record<string, jest.Mock>;
  let labOrdersGatewayMock: {
    broadcastNewLabOrder: jest.Mock;
    server: {
      emit: jest.Mock;
    };
  };
  let queueGatewayMock: Record<string, jest.Mock>;
  let queueServiceMock: Record<string, jest.Mock>;
  let sequenceServiceMock: Record<string, jest.Mock>;

  beforeEach(async () => {
    financeRepositoryMock = {
      findUniqueInvoice: jest.fn(),
      findManyInvoice: jest.fn(),
      createInvoice: jest.fn(),
      updateInvoice: jest.fn(),
      deleteInvoice: jest.fn(),
      createPayment: jest.fn(),
      findDraftInvoiceByType: jest.fn(),
      createInvoiceTransaction: jest.fn(),
      findInvoiceById: jest.fn(),
      syncLabInvoiceTransaction: jest.fn(),
      addInvoiceItemTransaction: jest.fn(),
      removeInvoiceItemTransaction: jest.fn(),
      findInvoiceDetailForPayment: jest.fn(),
      addPaymentTransaction: jest.fn(),
      findInvoiceDetailPostPayment: jest.fn(),
      findInvoiceDetailForFinalize: jest.fn(),
      finalizeInvoiceStatus: jest.fn(),
      findInvoicesInDateRange: jest.fn(),
      findInvoicesPaginated: jest.fn(),
      deleteInvoiceById: jest.fn(),
      findInvoiceDetailById: jest.fn(),
    };

    bookingRepositoryMock = {
      findUnique: jest.fn(),
      findUniqueBooking: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      findBookingForInvoiceCreation: jest.fn(),
      findWorkspaceQueueBookings: jest.fn(),
      findBookingsWithInvoicesInDateRange: jest.fn(),
      findTechnicians: jest.fn(),
      countCheckedInQueue: jest.fn(),
      findBookingPatientProfileId: jest.fn(),
      findInvoicesByBookingId: jest.fn(),
    };

    profileRepositoryMock = {
      findUniquePatientProfile: jest.fn(),
      findPatientProfileByUserId: jest.fn(),
    };

    clinicalRepositoryMock = {
      findUniqueMedicalRecord: jest.fn(),
      updateMedicalRecord: jest.fn(),
      findManyLabOrder: jest.fn(),
      findManyVisitServiceOrder: jest.fn(),
      findPaidVsoPerformers: jest.fn(),
      findPendingLabsForSync: jest.fn(),
      findPendingVsosForSync: jest.fn(),
    };

    notificationsServiceMock = {
      sendInvoiceEmail: jest.fn().mockResolvedValue(undefined),
      notifyAdmins: jest.fn().mockResolvedValue(undefined),
    };

    labOrdersGatewayMock = {
      broadcastNewLabOrder: jest.fn(),
      server: {
        emit: jest.fn(),
      },
    };

    queueGatewayMock = {
      broadcastQueueUpdate: jest.fn(),
    };

    queueServiceMock = {
      getOrCreateTodayQueue: jest.fn(),
    };

    sequenceServiceMock = {
      generateInvoiceNumber: jest.fn().mockResolvedValue('INV-2026-0001'),
      generateSequence: jest.fn(),
      generateNextSequence: jest.fn().mockResolvedValue(1),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BillingService,
        {
          provide: I_FINANCE_REPOSITORY,
          useValue: financeRepositoryMock,
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
          provide: I_CLINICAL_REPOSITORY,
          useValue: clinicalRepositoryMock,
        },
        {
          provide: NotificationsService,
          useValue: notificationsServiceMock,
        },
        {
          provide: LabOrdersGateway,
          useValue: labOrdersGatewayMock,
        },
        {
          provide: QueueGateway,
          useValue: queueGatewayMock,
        },
        {
          provide: QueueService,
          useValue: queueServiceMock,
        },
        {
          provide: SequenceService,
          useValue: sequenceServiceMock,
        },
      ],
    }).compile();

    service = module.get<BillingService>(BillingService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createInvoice', () => {
    it('should throw an ApiException if booking is not found', async () => {
      bookingRepositoryMock.findBookingForInvoiceCreation.mockResolvedValue(
        null,
      );

      await expect(
        service.createInvoice({
          bookingId: 'non-existent-booking-id',
          invoiceType: InvoiceType.CONSULTATION,
        }),
      ).rejects.toThrow(
        new ApiException(
          MessageCodes.BOOKING_NOT_FOUND,
          'Booking not found',
          HttpStatus.NOT_FOUND,
        ),
      );
    });

    it('should create new invoice if no draft exists', async () => {
      const mockBooking = {
        id: 'booking-1',
        patientProfileId: 'patient-profile-1',
        serviceId: 'service-1',
        service: { name: 'Consultation', price: 150000 },
        patientProfile: { id: 'patient-profile-1', fullName: 'Patient Name' },
      };
      bookingRepositoryMock.findBookingForInvoiceCreation.mockResolvedValue(
        mockBooking,
      );
      financeRepositoryMock.findDraftInvoiceByType.mockResolvedValue(null);
      sequenceServiceMock.generateNextSequence.mockResolvedValue(1);

      const mockCreatedInvoice = { id: 'invoice-1', invoiceNumber: 'INV-001' };
      financeRepositoryMock.createInvoiceTransaction.mockResolvedValue(
        mockCreatedInvoice,
      );

      const result = await service.createInvoice({
        bookingId: 'booking-1',
        invoiceType: InvoiceType.CONSULTATION,
      });

      expect(result).toEqual(mockCreatedInvoice);
      expect(financeRepositoryMock.createInvoiceTransaction).toHaveBeenCalled();
    });
  });

  describe('deleteInvoice', () => {
    it('should throw NOT_FOUND if invoice not found', async () => {
      financeRepositoryMock.findInvoiceById.mockResolvedValue(null);

      await expect(service.deleteInvoice('invoice-1')).rejects.toThrow(
        ApiException,
      );
    });

    it('should throw CONFLICT if invoice is not draft', async () => {
      financeRepositoryMock.findInvoiceById.mockResolvedValue({
        id: 'invoice-1',
        status: InvoiceStatus.PAID,
      });

      await expect(service.deleteInvoice('invoice-1')).rejects.toThrow(
        ApiException,
      );
    });

    it('should delete draft invoice', async () => {
      financeRepositoryMock.findInvoiceById.mockResolvedValue({
        id: 'invoice-1',
        status: InvoiceStatus.DRAFT,
      });
      financeRepositoryMock.deleteInvoiceById.mockResolvedValue({
        id: 'invoice-1',
      });

      const result = await service.deleteInvoice('invoice-1');
      expect(result).toBeNull();
      expect(financeRepositoryMock.deleteInvoiceById).toHaveBeenCalledWith(
        'invoice-1',
      );
    });
  });

  describe('syncLabInvoice', () => {
    it('should return null if no pending orders and no draft invoice exists', async () => {
      financeRepositoryMock.findDraftInvoiceByType.mockResolvedValue(null);
      clinicalRepositoryMock.findPendingLabsForSync.mockResolvedValue([]);
      clinicalRepositoryMock.findPendingVsosForSync.mockResolvedValue([]);

      const result = await service.syncLabInvoice('booking-1');
      expect(result).toBeNull();
    });

    it('should sync and refresh if draft invoice exists', async () => {
      financeRepositoryMock.findDraftInvoiceByType.mockResolvedValue({
        id: 'invoice-1',
      });
      clinicalRepositoryMock.findPendingLabsForSync.mockResolvedValue([
        { id: 'lab-1', testName: 'Test', service: { price: 100 } },
      ]);
      clinicalRepositoryMock.findPendingVsosForSync.mockResolvedValue([]);
      financeRepositoryMock.syncLabInvoiceTransaction.mockResolvedValue({
        deleted: false,
      });
      financeRepositoryMock.findInvoiceDetailById.mockResolvedValue({
        id: 'invoice-1',
      });

      await service.syncLabInvoice('booking-1');

      expect(
        financeRepositoryMock.syncLabInvoiceTransaction,
      ).toHaveBeenCalled();
      expect(labOrdersGatewayMock.server.emit).toHaveBeenCalledWith(
        'billing_list_refresh',
        { bookingId: 'booking-1' },
      );
    });
  });

  describe('addInvoiceItem', () => {
    it('should throw NOT_FOUND if invoice not found', async () => {
      financeRepositoryMock.findInvoiceById.mockResolvedValue(null);

      await expect(
        service.addInvoiceItem('invoice-1', {
          serviceId: 'service-1',
          itemName: 'Item',
          unitPrice: 100,
          quantity: 1,
        }),
      ).rejects.toThrow(ApiException);
    });

    it('should add item successfully if validation passes', async () => {
      financeRepositoryMock.findInvoiceById.mockResolvedValue({
        id: 'invoice-1',
        status: InvoiceStatus.DRAFT,
      });
      financeRepositoryMock.addInvoiceItemTransaction.mockResolvedValue({
        id: 'item-1',
      });

      const result = await service.addInvoiceItem('invoice-1', {
        serviceId: 'service-1',
        itemName: 'Item',
        unitPrice: 100,
        quantity: 1,
      });

      expect(result).toEqual({ id: 'item-1' });
    });
  });

  describe('removeInvoiceItem', () => {
    it('should remove item successfully if validation passes', async () => {
      financeRepositoryMock.findInvoiceById.mockResolvedValue({
        id: 'invoice-1',
        status: InvoiceStatus.DRAFT,
      });
      financeRepositoryMock.removeInvoiceItemTransaction.mockResolvedValue(
        undefined,
      );

      await expect(
        service.removeInvoiceItem('invoice-1', 'item-1'),
      ).resolves.toBeNull();
    });
  });

  describe('addPayment', () => {
    const mockInvoiceForPayment = {
      id: 'invoice-1',
      status: InvoiceStatus.DRAFT,
      invoiceType: InvoiceType.SERVICE,
      totalAmount: 200000,
      bookingId: 'booking-1',
      booking: {
        status: BookingStatus.PENDING,
        patientProfile: {
          userId: 'user-1',
          fullName: 'Test Patient',
        },
      },
      payments: [{ amountPaid: 50000, insuranceCovered: 0 }],
    };

    it('should throw if invoice not found', async () => {
      financeRepositoryMock.findInvoiceDetailForPayment.mockResolvedValue(null);

      await expect(
        service.addPayment(
          'invoice-1',
          {
            paymentMethod: PaymentMethod.CASH,
            amountPaid: 150000,
          },
          'user-admin',
        ),
      ).rejects.toThrow(ApiException);
    });

    it('should throw if invoice is already paid', async () => {
      financeRepositoryMock.findInvoiceDetailForPayment.mockResolvedValue({
        ...mockInvoiceForPayment,
        status: InvoiceStatus.PAID,
      });

      await expect(
        service.addPayment(
          'invoice-1',
          {
            paymentMethod: PaymentMethod.CASH,
            amountPaid: 150000,
          },
          'user-admin',
        ),
      ).rejects.toThrow(ApiException);
    });

    it('should record payment successfully and auto-finalize if total matches', async () => {
      financeRepositoryMock.findInvoiceDetailForPayment.mockResolvedValue(
        mockInvoiceForPayment,
      );
      bookingRepositoryMock.findTechnicians.mockResolvedValue([
        { id: 'tech-1' },
      ]);
      financeRepositoryMock.addPaymentTransaction.mockResolvedValue({
        paidVsoIds: ['vso-1'],
        broadcastPayload: {
          labOrderIds: ['lab-1'],
          patientName: 'Test Patient',
          invoiceId: 'invoice-1',
        },
      });

      const mockUpdated = {
        id: 'invoice-1',
        invoiceNumber: 'INV-123',
        createdAt: new Date(),
        invoiceType: InvoiceType.CONSULTATION,
        totalAmount: 200000,
        booking: {
          patientProfile: {
            userId: 'user-1',
            fullName: 'Test Patient',
            user: { email: 'patient@example.com' },
          },
        },
      };
      financeRepositoryMock.findInvoiceDetailPostPayment.mockResolvedValue(
        mockUpdated,
      );
      clinicalRepositoryMock.findPaidVsoPerformers.mockResolvedValue(['doc-1']);

      const result = await service.addPayment(
        'invoice-1',
        {
          paymentMethod: PaymentMethod.CASH,
          amountPaid: 150000,
        },
        'user-admin',
      );

      expect(result).toEqual(mockUpdated);
      expect(financeRepositoryMock.addPaymentTransaction).toHaveBeenCalled();
      expect(labOrdersGatewayMock.broadcastNewLabOrder).toHaveBeenCalled();
      expect(queueGatewayMock.broadcastQueueUpdate).toHaveBeenCalledWith(
        'doc-1',
        'CHECK_IN',
        expect.any(Object),
      );
      expect(notificationsServiceMock.sendInvoiceEmail).toHaveBeenCalled();
    });
  });

  describe('finalizeInvoice', () => {
    it('should throw if invoice not found', async () => {
      financeRepositoryMock.findInvoiceDetailForFinalize.mockResolvedValue(
        null,
      );

      await expect(service.finalizeInvoice('invoice-1')).rejects.toThrow(
        ApiException,
      );
    });

    it('should throw if already paid', async () => {
      financeRepositoryMock.findInvoiceDetailForFinalize.mockResolvedValue({
        id: 'invoice-1',
        status: InvoiceStatus.PAID,
      });

      await expect(service.finalizeInvoice('invoice-1')).rejects.toThrow(
        ApiException,
      );
    });

    it('should finalize invoice successfully and notify', async () => {
      financeRepositoryMock.findInvoiceDetailForFinalize.mockResolvedValue({
        id: 'invoice-1',
        status: InvoiceStatus.ISSUED,
        payments: [{ insuranceCovered: 50000, patientPaid: 100000 }],
      });

      const mockUpdated = {
        id: 'invoice-1',
        invoiceNumber: 'INV-123',
        createdAt: new Date(),
        invoiceType: InvoiceType.CONSULTATION,
        totalAmount: 150000,
        booking: {
          patientProfile: {
            userId: 'user-1',
            fullName: 'Test Patient',
            user: { email: 'patient@example.com' },
          },
        },
      };

      financeRepositoryMock.finalizeInvoiceStatus.mockResolvedValue(
        mockUpdated,
      );

      const result = await service.finalizeInvoice('invoice-1');

      expect(result).toEqual(mockUpdated);
      expect(notificationsServiceMock.sendInvoiceEmail).toHaveBeenCalled();
      expect(notificationsServiceMock.notifyAdmins).toHaveBeenCalled();
    });
  });

  describe('listMyInvoices', () => {
    it('should return empty list if patient profile not found', async () => {
      profileRepositoryMock.findPatientProfileByUserId.mockResolvedValue(null);

      const result = (await service.listMyInvoices('user-1', {})) as {
        invoices: unknown[];
        pagination: { total: number };
      };

      expect(result.invoices).toEqual([]);
      expect(result.pagination.total).toBe(0);
    });

    it('should return invoices for patient', async () => {
      profileRepositoryMock.findPatientProfileByUserId.mockResolvedValue({
        id: 'patient-profile-1',
      });
      financeRepositoryMock.findInvoicesPaginated.mockResolvedValue({
        items: [{ id: 'invoice-1' }],
        total: 1,
      });

      const result = (await service.listMyInvoices('user-1', {
        page: 1,
        limit: 10,
      })) as {
        items: unknown[];
        total: number;
      };

      expect(result.items).toEqual([{ id: 'invoice-1' }]);
      expect(result.total).toBe(1);
    });
  });

  describe('getWorkspaceQueue', () => {
    it('should return list of mapped queue items', async () => {
      const mockBookings = [
        {
          id: 'booking-1',
          status: BookingStatus.COMPLETED,
          bookingCode: 'BK-1',
          createdAt: new Date(),
          priority: 'NORMAL',
          patientProfile: {
            fullName: 'Name',
            patientCode: 'P-1',
            gender: 'M',
            dateOfBirth: '1990-01-01',
          },
          doctor: { fullName: 'Doc' },
          medicalRecord: { visitStep: VisitStep.SERVICES_ORDERED },
          invoices: [
            {
              totalAmount: 100000,
              status: InvoiceStatus.PAID,
              invoiceType: InvoiceType.CONSULTATION,
            },
          ],
        },
      ];
      bookingRepositoryMock.findWorkspaceQueueBookings.mockResolvedValue(
        mockBookings,
      );

      const result = await service.getWorkspaceQueue({});

      expect(result.length).toBe(1);
      expect(result[0].currentStepCode).toBe('B8');
    });
  });

  describe('getWorkspaceKpis', () => {
    it('should return calculated KPIs', async () => {
      financeRepositoryMock.findInvoicesInDateRange.mockResolvedValue([
        { status: InvoiceStatus.PAID, totalAmount: 200000 },
        { status: InvoiceStatus.DRAFT, totalAmount: 50000 },
      ]);
      bookingRepositoryMock.findBookingsWithInvoicesInDateRange.mockResolvedValue(
        [
          { invoices: [{ status: InvoiceStatus.PAID }] },
          { invoices: [{ status: InvoiceStatus.DRAFT }] },
        ],
      );

      const result = await service.getWorkspaceKpis();

      expect(result.totalRevenue).toBe(200000);
      expect(result.totalInvoicesValue).toBe(250000);
      expect(result.awaitingPaymentCount).toBe(1);
      expect(result.completedPaymentCount).toBe(1);
    });
  });
});
