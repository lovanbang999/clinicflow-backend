import { Test, TestingModule } from '@nestjs/testing';
import { MedicalRecordsService } from './medical-records.service';
import {
  I_CLINICAL_REPOSITORY,
  IClinicalRepository,
} from '../database/interfaces/clinical.repository.interface';
import {
  I_BOOKING_REPOSITORY,
  IBookingRepository,
} from '../database/interfaces/booking.repository.interface';
import {
  I_PROFILE_REPOSITORY,
  IProfileRepository,
} from '../database/interfaces/profile.repository.interface';
import { NotificationsService } from '../notifications/notifications.service';
import { BillingService } from '../billing/billing.service';
import { QueueGateway } from '../queue/queue.gateway';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import {
  ServiceOrderStatus,
  VisitStep,
  NotificationType,
  UserRole,
} from '@prisma/client';

type MockClinicalRepo = Partial<Record<keyof IClinicalRepository, jest.Mock>>;
type MockBookingRepo = Partial<Record<keyof IBookingRepository, jest.Mock>>;
type MockProfileRepo = Partial<Record<keyof IProfileRepository, jest.Mock>>;

const buildBooking = (overrides: Record<string, unknown> = {}) => ({
  id: 'booking-1',
  bookingCode: 'BK001',
  doctorId: 'doctor-1',
  patientProfileId: 'profile-1',
  status: 'CHECKED_IN',
  patientProfile: {
    id: 'profile-1',
    userId: 'patient-user-1',
    fullName: 'Patient A',
    user: { email: 'patient@test.com' },
  },
  ...overrides,
});

const buildMedicalRecord = (overrides: Record<string, unknown> = {}) => ({
  id: 'record-1',
  bookingId: 'booking-1',
  visitStep: VisitStep.SYMPTOMS_TAKEN,
  isFinalized: false,
  diagnosisCode: null,
  diagnosisName: null,
  prescription: null,
  booking: {
    doctorId: 'doctor-1',
    patientProfile: { userId: 'patient-user-1', fullName: 'Patient A' },
  },
  ...overrides,
});

describe('MedicalRecordsService', () => {
  let service: MedicalRecordsService;
  let clinicalRepository: MockClinicalRepo;
  let bookingRepository: MockBookingRepo;
  let profileRepository: MockProfileRepo;
  let notificationsService: {
    createInAppNotification: jest.Mock;
    notifyRole: jest.Mock;
    sendPostVisitEmail: jest.Mock;
  };
  let billingService: { syncLabInvoice: jest.Mock };
  let queueGateway: { broadcastQueueUpdate: jest.Mock };

  beforeEach(async () => {
    clinicalRepository = {
      findMedicalRecordDetailByBookingId: jest.fn(),
      saveSymptomsTransaction: jest.fn(),
      findActiveServicesWithDoctors: jest.fn(),
      orderServicesTransaction: jest.fn(),
      findVisitServiceOrderById: jest.fn(),
      deleteVisitServiceOrderById: jest.fn(),
      countVisitServiceOrdersByMedicalRecordId: jest.fn(),
      saveDiagnosis: jest.fn(),
      savePrescriptionTransaction: jest.fn(),
      searchICD10: jest.fn(),
      searchMedicines: jest.fn(),
      findPatientHistory: jest.fn(),
      getPatientClinicalStats: jest.fn(),
      getDoctorClinicalStats: jest.fn(),
      checkAndAdvanceToResultsReadyTransaction: jest.fn(),
      fulfillPrescriptionTransaction: jest.fn(),
      startSpecialistExaminationTransaction: jest.fn(),
      completeSpecialistExaminationTransaction: jest.fn(),
    };

    bookingRepository = {
      findBookingById: jest.fn(),
      hasTreatmentRelationship: jest.fn(),
      findBookingForPostVisitEmail: jest.fn(),
      countActiveBookingsForPatient: jest.fn(),
      getDoctorBookingStats: jest.fn(),
    };

    profileRepository = {
      findPatientProfileByUserId: jest.fn(),
      findPatientProfileById: jest.fn(),
    };

    notificationsService = {
      createInAppNotification: jest.fn().mockResolvedValue(undefined),
      notifyRole: jest.fn().mockResolvedValue(undefined),
      sendPostVisitEmail: jest.fn().mockResolvedValue(undefined),
    };

    billingService = {
      syncLabInvoice: jest.fn().mockResolvedValue(undefined),
    };

    queueGateway = {
      broadcastQueueUpdate: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MedicalRecordsService,
        { provide: I_CLINICAL_REPOSITORY, useValue: clinicalRepository },
        { provide: I_BOOKING_REPOSITORY, useValue: bookingRepository },
        { provide: I_PROFILE_REPOSITORY, useValue: profileRepository },
        { provide: NotificationsService, useValue: notificationsService },
        { provide: BillingService, useValue: billingService },
        { provide: QueueGateway, useValue: queueGateway },
      ],
    }).compile();

    service = module.get<MedicalRecordsService>(MedicalRecordsService);
  });

  describe('saveSymptoms', () => {
    it('should save symptoms successfully and return a medical record detail', async () => {
      // Arrange
      const booking = buildBooking();
      const savedRecord = buildMedicalRecord({ visitStep: VisitStep.SYMPTOMS_TAKEN });
      const dto = { chiefComplaint: 'Headache', clinicalFindings: 'Normal BP' };

      (bookingRepository.findBookingById as jest.Mock).mockResolvedValue(booking);
      (clinicalRepository.saveSymptomsTransaction as jest.Mock).mockResolvedValue(savedRecord);

      // Act
      const result = await service.saveSymptoms('booking-1', dto, 'doctor-1');

      // Assert
      expect(result).toEqual(savedRecord);
      expect(clinicalRepository.saveSymptomsTransaction).toHaveBeenCalledWith(
        'booking-1',
        'doctor-1',
        booking.patientProfileId,
        dto,
      );
    });

    it('should throw NotFoundException when booking does not exist', async () => {
      // Arrange
      (bookingRepository.findBookingById as jest.Mock).mockResolvedValue(null);

      // Act & Assert
      await expect(service.saveSymptoms('missing', {}, 'doctor-1')).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException when doctor is not the assigned doctor', async () => {
      // Arrange
      const booking = buildBooking({ doctorId: 'other-doctor' });
      const currentUser = { id: 'doctor-1', role: 'DOCTOR' } as Express.User;
      (bookingRepository.findBookingById as jest.Mock).mockResolvedValue(booking);

      // Act & Assert
      await expect(
        service.saveSymptoms('booking-1', {}, 'doctor-1', currentUser),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should call clinical repository with domain-level parameters only (no Prisma objects)', async () => {
      // Arrange
      const booking = buildBooking();
      (bookingRepository.findBookingById as jest.Mock).mockResolvedValue(booking);
      (clinicalRepository.saveSymptomsTransaction as jest.Mock).mockResolvedValue(buildMedicalRecord());

      // Act
      await service.saveSymptoms('booking-1', { chiefComplaint: 'Fever' }, 'doctor-1');

      // Assert
      const [bId, dId, ppId, dto] = (clinicalRepository.saveSymptomsTransaction as jest.Mock).mock.calls[0];
      expect(typeof bId).toBe('string');
      expect(typeof dId).toBe('string');
      expect(typeof ppId).toBe('string');
      expect(typeof dto).toBe('object');
      // Crucially: no Prisma where/include/data shape
      expect(dto).not.toHaveProperty('where');
      expect(dto).not.toHaveProperty('include');
    });
  });

  describe('saveDiagnosis', () => {
    it('should save diagnosis when no service orders and any visitStep', async () => {
      // Arrange
      const booking = buildBooking();
      const record = buildMedicalRecord({ visitStep: VisitStep.SYMPTOMS_TAKEN });
      const updatedRecord = buildMedicalRecord({ visitStep: VisitStep.DIAGNOSED });
      const dto = { diagnosisCode: 'J00', diagnosisName: 'Common Cold' };

      (bookingRepository.findBookingById as jest.Mock).mockResolvedValue(booking);
      (clinicalRepository.findMedicalRecordDetailByBookingId as jest.Mock).mockResolvedValue(record);
      (clinicalRepository.countVisitServiceOrdersByMedicalRecordId as jest.Mock).mockResolvedValue(0);
      (clinicalRepository.saveDiagnosis as jest.Mock).mockResolvedValue(updatedRecord);

      // Act
      const result = await service.saveDiagnosis('booking-1', dto, 'doctor-1');

      // Assert
      expect(result).toEqual(updatedRecord);
      expect(clinicalRepository.saveDiagnosis).toHaveBeenCalledWith(record.id, dto);
    });

    it('should save diagnosis when visitStep is RESULTS_READY (with service orders)', async () => {
      // Arrange
      const booking = buildBooking();
      const record = buildMedicalRecord({ visitStep: VisitStep.RESULTS_READY });
      (bookingRepository.findBookingById as jest.Mock).mockResolvedValue(booking);
      (clinicalRepository.findMedicalRecordDetailByBookingId as jest.Mock).mockResolvedValue(record);
      (clinicalRepository.countVisitServiceOrdersByMedicalRecordId as jest.Mock).mockResolvedValue(2);
      (clinicalRepository.saveDiagnosis as jest.Mock).mockResolvedValue(buildMedicalRecord({ visitStep: VisitStep.DIAGNOSED }));

      // Act
      const result = await service.saveDiagnosis('booking-1', {}, 'doctor-1');

      // Assert
      expect(result).toBeDefined();
    });

    it('should throw BadRequestException when orders exist and visitStep is not RESULTS_READY/DIAGNOSED', async () => {
      // Arrange
      const booking = buildBooking();
      const record = buildMedicalRecord({ visitStep: VisitStep.SYMPTOMS_TAKEN });
      (bookingRepository.findBookingById as jest.Mock).mockResolvedValue(booking);
      (clinicalRepository.findMedicalRecordDetailByBookingId as jest.Mock).mockResolvedValue(record);
      (clinicalRepository.countVisitServiceOrdersByMedicalRecordId as jest.Mock).mockResolvedValue(2);

      // Act & Assert
      await expect(service.saveDiagnosis('booking-1', {}, 'doctor-1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw NotFoundException when medical record is missing', async () => {
      // Arrange
      (bookingRepository.findBookingById as jest.Mock).mockResolvedValue(buildBooking());
      (clinicalRepository.findMedicalRecordDetailByBookingId as jest.Mock).mockResolvedValue(null);

      // Act & Assert
      await expect(service.saveDiagnosis('booking-1', {}, 'doctor-1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('savePrescription', () => {
    const makeValidPrescriptionSetup = () => {
      const booking = buildBooking();
      const record = buildMedicalRecord({ visitStep: VisitStep.DIAGNOSED });
      const updatedRecord = buildMedicalRecord({ visitStep: VisitStep.PRESCRIBED });

      (bookingRepository.findBookingById as jest.Mock).mockResolvedValue(booking);
      (clinicalRepository.findMedicalRecordDetailByBookingId as jest.Mock).mockResolvedValue(record);
      (clinicalRepository.savePrescriptionTransaction as jest.Mock).mockResolvedValue(updatedRecord);
      (bookingRepository.findBookingForPostVisitEmail as jest.Mock).mockResolvedValue(null); // skip email

      return { booking, record, updatedRecord };
    };

    it('should save prescription when visitStep is DIAGNOSED', async () => {
      // Arrange
      const { updatedRecord } = makeValidPrescriptionSetup();
      const dto = { items: [{ medicineName: 'Paracetamol', dosage: '500mg', frequency: '3x/day', quantity: 21, unitPrice: 5000 }] };

      // Act
      const result = await service.savePrescription('booking-1', dto, 'doctor-1');

      // Assert
      expect(result).toEqual(updatedRecord);
      expect(clinicalRepository.savePrescriptionTransaction).toHaveBeenCalledWith(
        'booking-1',
        'doctor-1',
        'record-1',
        'profile-1',
        'CHECKED_IN',
        dto,
      );
    });

    it('should throw BadRequestException when visitStep is not DIAGNOSED/PRESCRIBED/COMPLETED', async () => {
      // Arrange
      const booking = buildBooking();
      const record = buildMedicalRecord({ visitStep: VisitStep.SYMPTOMS_TAKEN });
      (bookingRepository.findBookingById as jest.Mock).mockResolvedValue(booking);
      (clinicalRepository.findMedicalRecordDetailByBookingId as jest.Mock).mockResolvedValue(record);

      // Act & Assert
      await expect(
        service.savePrescription('booking-1', { items: [] }, 'doctor-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException when medical record is missing', async () => {
      // Arrange
      (bookingRepository.findBookingById as jest.Mock).mockResolvedValue(buildBooking());
      (clinicalRepository.findMedicalRecordDetailByBookingId as jest.Mock).mockResolvedValue(null);

      // Act & Assert
      await expect(
        service.savePrescription('booking-1', { items: [] }, 'doctor-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should notify receptionist after successful prescription', async () => {
      // Arrange
      makeValidPrescriptionSetup();
      const dto = { items: [{ medicineName: 'Amox', dosage: '250mg', frequency: '2x/day', quantity: 10, unitPrice: 3000 }] };

      // Act
      await service.savePrescription('booking-1', dto, 'doctor-1');

      // Assert
      expect(notificationsService.notifyRole).toHaveBeenCalledWith(
        expect.objectContaining({ role: UserRole.RECEPTIONIST }),
      );
    });
  });

  describe('orderServices', () => {
    it('should order services, sync invoice, and notify receptionist and patient', async () => {
      // Arrange
      const booking = buildBooking();
      const servicesWithDoctors = [
        { id: 'svc-1', performerType: 'TECHNICIAN', name: 'X-Ray', doctorServices: [] },
        { id: 'svc-2', performerType: 'TECHNICIAN', name: 'Blood Test', doctorServices: [] },
      ];
      const dto = { items: [{ serviceId: 'svc-1' }, { serviceId: 'svc-2' }] };
      const orderResult = { record: buildMedicalRecord(), orders: [], labOrders: [] };

      (bookingRepository.findBookingById as jest.Mock).mockResolvedValue(booking);
      (clinicalRepository.findActiveServicesWithDoctors as jest.Mock).mockResolvedValue(servicesWithDoctors);
      (clinicalRepository.orderServicesTransaction as jest.Mock).mockResolvedValue(orderResult);

      // Act
      const result = await service.orderServices('booking-1', dto, 'doctor-1');

      // Assert
      expect(result).toEqual(orderResult);
      expect(billingService.syncLabInvoice).toHaveBeenCalledWith('booking-1');
      expect(notificationsService.notifyRole).toHaveBeenCalledWith(
        expect.objectContaining({ role: UserRole.RECEPTIONIST }),
      );
      expect(notificationsService.createInAppNotification).toHaveBeenCalledWith(
        expect.objectContaining({ userId: booking.patientProfile.userId }),
      );
    });

    it('should throw BadRequestException when any serviceId is invalid', async () => {
      // Arrange
      const booking = buildBooking();
      const dto = { items: [{ serviceId: 'svc-1' }, { serviceId: 'svc-invalid' }] };

      (bookingRepository.findBookingById as jest.Mock).mockResolvedValue(booking);
      // Only 1 found, but 2 requested
      (clinicalRepository.findActiveServicesWithDoctors as jest.Mock).mockResolvedValue([
        { id: 'svc-1', performerType: 'TECHNICIAN', name: 'X-Ray' },
      ]);

      // Act & Assert
      await expect(service.orderServices('booking-1', dto, 'doctor-1')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('completeSpecialistExamination', () => {
    it('should complete examination and fire notifications when advanced', async () => {
      // Arrange
      const vso = {
        id: 'vso-1',
        performedBy: 'doctor-1',
        status: ServiceOrderStatus.IN_PROGRESS,
        bookingId: 'booking-1',
      };
      const updatedVso = { ...vso, status: ServiceOrderStatus.COMPLETED };
      const record = buildMedicalRecord({ visitStep: VisitStep.RESULTS_READY });
      record.booking.doctorId = 'doctor-1';

      (clinicalRepository.findVisitServiceOrderById as jest.Mock).mockResolvedValue(vso);
      (clinicalRepository.completeSpecialistExaminationTransaction as jest.Mock).mockResolvedValue({
        updatedVso,
        advanced: true,
        record,
      });

      // Act
      const result = await service.completeSpecialistExamination('vso-1', 'doctor-1', { resultText: 'Normal' });

      // Assert
      expect(result).toEqual(updatedVso);
      // give micro-task queue time
      await new Promise((r) => setTimeout(r, 0));
      expect(notificationsService.createInAppNotification).toHaveBeenCalledWith(
        expect.objectContaining({ type: NotificationType.LAB_RESULT_READY }),
      );
      expect(queueGateway.broadcastQueueUpdate).toHaveBeenCalledWith(
        record.booking.doctorId,
        'UPDATE',
        expect.objectContaining({ visitStep: VisitStep.RESULTS_READY }),
      );
    });

    it('should throw NotFoundException when vso does not exist', async () => {
      // Arrange
      (clinicalRepository.findVisitServiceOrderById as jest.Mock).mockResolvedValue(null);

      // Act & Assert
      await expect(service.completeSpecialistExamination('bad', 'doctor-1', { resultText: 'Test' })).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException when doctor is not assigned to the VSO', async () => {
      // Arrange
      const vso = { id: 'vso-1', performedBy: 'other-doctor', status: ServiceOrderStatus.PAID };
      (clinicalRepository.findVisitServiceOrderById as jest.Mock).mockResolvedValue(vso);

      // Act & Assert
      await expect(service.completeSpecialistExamination('vso-1', 'doctor-1', { resultText: 'Test' })).rejects.toThrow(ForbiddenException);
    });

    it('should throw BadRequestException for invalid status', async () => {
      // Arrange
      const vso = { id: 'vso-1', performedBy: 'doctor-1', status: ServiceOrderStatus.CANCELLED };
      (clinicalRepository.findVisitServiceOrderById as jest.Mock).mockResolvedValue(vso);

      // Act & Assert
      await expect(service.completeSpecialistExamination('vso-1', 'doctor-1', { resultText: 'Test' })).rejects.toThrow(BadRequestException);
    });
  });

  describe('checkAndAdvanceToResultsReady', () => {
    it('should call transaction and fire notifications when advanced', async () => {
      // Arrange
      const record = buildMedicalRecord({ visitStep: VisitStep.RESULTS_READY });
      record.booking.doctorId = 'doctor-1';

      (clinicalRepository.checkAndAdvanceToResultsReadyTransaction as jest.Mock).mockResolvedValue({
        advanced: true,
        record,
      });

      // Act
      await service.checkAndAdvanceToResultsReady('record-1');

      // Assert
      await new Promise((r) => setTimeout(r, 0));
      expect(notificationsService.createInAppNotification).toHaveBeenCalledWith(
        expect.objectContaining({ userId: record.booking.doctorId }),
      );
    });

    it('should not fire notifications when not advanced', async () => {
      // Arrange
      (clinicalRepository.checkAndAdvanceToResultsReadyTransaction as jest.Mock).mockResolvedValue({
        advanced: false,
        record: null,
      });

      // Act
      await service.checkAndAdvanceToResultsReady('record-1');

      // Assert
      await new Promise((r) => setTimeout(r, 0));
      expect(notificationsService.createInAppNotification).not.toHaveBeenCalled();
    });
  });

  describe('fulfillPrescription', () => {
    it('should fulfill an unfulfilled prescription', async () => {
      // Arrange
      const record = buildMedicalRecord({
        prescription: { id: 'rx-1', isFulfilledInternally: false },
      });
      (clinicalRepository.findMedicalRecordDetailByBookingId as jest.Mock).mockResolvedValue(record);
      (clinicalRepository.fulfillPrescriptionTransaction as jest.Mock).mockResolvedValue({
        id: 'rx-1',
        isFulfilledInternally: true,
      });

      // Act
      const result = await service.fulfillPrescription('booking-1');

      // Assert
      expect(result).toMatchObject({ isFulfilledInternally: true });
      expect(clinicalRepository.fulfillPrescriptionTransaction).toHaveBeenCalledWith('rx-1', undefined);
    });

    it('should throw NotFoundException when medical record is missing', async () => {
      // Arrange
      (clinicalRepository.findMedicalRecordDetailByBookingId as jest.Mock).mockResolvedValue(null);

      // Act & Assert
      await expect(service.fulfillPrescription('booking-1')).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException when prescription is missing', async () => {
      // Arrange
      const record = buildMedicalRecord({ prescription: null });
      (clinicalRepository.findMedicalRecordDetailByBookingId as jest.Mock).mockResolvedValue(record);

      // Act & Assert
      await expect(service.fulfillPrescription('booking-1')).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when prescription already fulfilled', async () => {
      // Arrange
      const record = buildMedicalRecord({
        prescription: { id: 'rx-1', isFulfilledInternally: true },
      });
      (clinicalRepository.findMedicalRecordDetailByBookingId as jest.Mock).mockResolvedValue(record);

      // Act & Assert
      await expect(service.fulfillPrescription('booking-1')).rejects.toThrow(BadRequestException);
    });
  });
});
