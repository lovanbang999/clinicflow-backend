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

describe('BillingService', () => {
  let service: BillingService;
  let financeRepositoryMock: Record<string, jest.Mock>;
  let bookingRepositoryMock: Record<string, jest.Mock>;
  let profileRepositoryMock: Record<string, jest.Mock>;
  let clinicalRepositoryMock: Record<string, jest.Mock>;

  beforeEach(async () => {
    financeRepositoryMock = {
      findUniqueInvoice: jest.fn(),
      findManyInvoice: jest.fn(),
      createInvoice: jest.fn(),
      updateInvoice: jest.fn(),
      deleteInvoice: jest.fn(),
      createPayment: jest.fn(),
    };

    bookingRepositoryMock = {
      findUnique: jest.fn(),
      findUniqueBooking: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
    };

    profileRepositoryMock = {
      findUniquePatientProfile: jest.fn(),
    };

    clinicalRepositoryMock = {
      findUniqueMedicalRecord: jest.fn(),
      updateMedicalRecord: jest.fn(),
      findManyLabOrder: jest.fn(),
      findManyVisitServiceOrder: jest.fn(),
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
          useValue: {
            createNotification: jest.fn(),
          },
        },
        {
          provide: LabOrdersGateway,
          useValue: {
            broadcastLabResultCompleted: jest.fn(),
          },
        },
        {
          provide: QueueGateway,
          useValue: {
            broadcastQueueUpdate: jest.fn(),
          },
        },
        {
          provide: QueueService,
          useValue: {
            getOrCreateTodayQueue: jest.fn(),
          },
        },
        {
          provide: SequenceService,
          useValue: {
            generateInvoiceNumber: jest.fn().mockResolvedValue('INV-2026-0001'),
            generateSequence: jest.fn(),
          },
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
      bookingRepositoryMock.findUniqueBooking.mockResolvedValue(null);

      await expect(
        service.createInvoice({
          bookingId: 'non-existent-booking-id',
          invoiceType: 'CONSULTATION',
        }),
      ).rejects.toThrow(
        new ApiException(
          MessageCodes.BOOKING_NOT_FOUND,
          'Booking not found',
          HttpStatus.NOT_FOUND,
        ),
      );
    });
  });
});
