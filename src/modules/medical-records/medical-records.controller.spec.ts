import { Test, TestingModule } from '@nestjs/testing';
import { MedicalRecordsController } from './medical-records.controller';
import { MedicalRecordsService } from './medical-records.service';
import {
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { CreateMedicalRecordDto } from './dto/create-medical-record.dto';
import { CreatePrescriptionDto } from './dto/create-prescription.dto';
import { OrderServicesDto } from './dto/order-services.dto';
import { SaveDiagnosisDto } from './dto/save-diagnosis.dto';
import { SaveSymptomsDto } from './dto/save-symptoms.dto';
import { CompleteSpecialistExamDto } from './dto/complete-specialist-exam.dto';
import { User, UserRole } from '@prisma/client';

describe('MedicalRecordsController', () => {
  let controller: MedicalRecordsController;
  let serviceMock: Record<string, jest.Mock>;

  const mockUser = {
    id: 'u-1',
    email: 'test@example.com',
    role: UserRole.DOCTOR,
  } as unknown as User;

  beforeEach(async () => {
    serviceMock = {
      upsertMedicalRecord: jest.fn(),
      saveSymptoms: jest.fn(),
      orderServices: jest.fn(),
      removeServiceOrder: jest.fn(),
      getVisitResults: jest.fn(),
      saveDiagnosis: jest.fn(),
      savePrescription: jest.fn(),
      fulfillPrescription: jest.fn(),
      searchICD10: jest.fn(),
      searchMedicines: jest.fn(),
      getPatientHistory: jest.fn(),
      getMyVisits: jest.fn(),
      getPatientStats: jest.fn(),
      getDoctorStats: jest.fn(),
      startSpecialistExamination: jest.fn(),
      completeSpecialistExamination: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [MedicalRecordsController],
      providers: [
        {
          provide: MedicalRecordsService,
          useValue: serviceMock,
        },
      ],
    }).compile();

    controller = module.get<MedicalRecordsController>(MedicalRecordsController);
  });

  it('upsertMedicalRecord should delegate to medicalRecordsService.upsertMedicalRecord', async () => {
    const dto: CreateMedicalRecordDto = { bookingId: 'b-1' };
    serviceMock.upsertMedicalRecord.mockResolvedValue({ id: 'mr-1' });
    const result = await controller.upsertMedicalRecord(dto, mockUser);
    expect(result).toEqual({ id: 'mr-1' });
    expect(serviceMock.upsertMedicalRecord).toHaveBeenCalledWith(
      dto,
      'u-1',
      mockUser,
    );
  });

  it('saveSymptoms should delegate to medicalRecordsService.saveSymptoms', async () => {
    const dto: SaveSymptomsDto = { chiefComplaint: 'fever' };
    serviceMock.saveSymptoms.mockResolvedValue({ success: true });
    const result = await controller.saveSymptoms('b-1', dto, mockUser);
    expect(result).toEqual({ success: true });
    expect(serviceMock.saveSymptoms).toHaveBeenCalledWith(
      'b-1',
      dto,
      'u-1',
      mockUser,
    );
  });

  it('orderServices should delegate to medicalRecordsService.orderServices', async () => {
    const dto: OrderServicesDto = { items: [{ serviceId: 's-1' }] };
    serviceMock.orderServices.mockResolvedValue({ success: true });
    const result = await controller.orderServices('b-1', dto, mockUser);
    expect(result).toEqual({ success: true });
    expect(serviceMock.orderServices).toHaveBeenCalledWith(
      'b-1',
      dto,
      'u-1',
      mockUser,
    );
  });

  it('removeServiceOrder should delegate to medicalRecordsService.removeServiceOrder', async () => {
    serviceMock.removeServiceOrder.mockResolvedValue({ success: true });
    const result = await controller.removeServiceOrder(
      'b-1',
      'order-1',
      mockUser,
    );
    expect(result).toEqual({ success: true });
    expect(serviceMock.removeServiceOrder).toHaveBeenCalledWith(
      'b-1',
      'order-1',
      'u-1',
      mockUser,
    );
  });

  it('getVisitResults should delegate to medicalRecordsService.getVisitResults', async () => {
    serviceMock.getVisitResults.mockResolvedValue([]);
    const result = await controller.getVisitResults('b-1', mockUser);
    expect(result).toEqual([]);
    expect(serviceMock.getVisitResults).toHaveBeenCalledWith('b-1', mockUser);
  });

  it('saveDiagnosis should delegate to medicalRecordsService.saveDiagnosis', async () => {
    const dto: SaveDiagnosisDto = {
      diagnosisCode: 'A00',
      diagnosisName: 'Cholera',
    };
    serviceMock.saveDiagnosis.mockResolvedValue({ success: true });
    const result = await controller.saveDiagnosis('b-1', dto, mockUser);
    expect(result).toEqual({ success: true });
    expect(serviceMock.saveDiagnosis).toHaveBeenCalledWith(
      'b-1',
      dto,
      'u-1',
      mockUser,
    );
  });

  it('savePrescription should delegate to medicalRecordsService.savePrescription', async () => {
    const dto: CreatePrescriptionDto = { items: [] };
    serviceMock.savePrescription.mockResolvedValue({ success: true });
    const result = await controller.savePrescription('b-1', dto, mockUser);
    expect(result).toEqual({ success: true });
    expect(serviceMock.savePrescription).toHaveBeenCalledWith(
      'b-1',
      dto,
      'u-1',
      mockUser,
    );
  });

  it('fulfillPrescription should delegate to medicalRecordsService.fulfillPrescription', async () => {
    serviceMock.fulfillPrescription.mockResolvedValue({ success: true });
    const result = await controller.fulfillPrescription('b-1', 'invoice-1');
    expect(result).toEqual({ success: true });
    expect(serviceMock.fulfillPrescription).toHaveBeenCalledWith(
      'b-1',
      'invoice-1',
    );
  });

  it('searchICD10 should delegate to medicalRecordsService.searchICD10', async () => {
    serviceMock.searchICD10.mockResolvedValue([]);
    const result = await controller.searchICD10('cholera');
    expect(result).toEqual([]);
    expect(serviceMock.searchICD10).toHaveBeenCalledWith('cholera');
  });

  it('searchMedicines should delegate to medicalRecordsService.searchMedicines', async () => {
    serviceMock.searchMedicines.mockResolvedValue([]);
    const result = await controller.searchMedicines('para');
    expect(result).toEqual([]);
    expect(serviceMock.searchMedicines).toHaveBeenCalledWith('para');
  });

  it('getPatientHistory should delegate to medicalRecordsService.getPatientHistory', async () => {
    serviceMock.getPatientHistory.mockResolvedValue([]);
    const result = await controller.getPatientHistory('p-1', 2, 5, mockUser);
    expect(result).toEqual([]);
    expect(serviceMock.getPatientHistory).toHaveBeenCalledWith(
      'p-1',
      2,
      5,
      mockUser,
    );
  });

  it('getMyVisits should delegate to medicalRecordsService.getMyVisits', async () => {
    serviceMock.getMyVisits.mockResolvedValue([]);
    const result = await controller.getMyVisits(mockUser, 2, 5);
    expect(result).toEqual([]);
    expect(serviceMock.getMyVisits).toHaveBeenCalledWith('u-1', 2, 5, mockUser);
  });

  it('getPatientStats should delegate to medicalRecordsService.getPatientStats', async () => {
    serviceMock.getPatientStats.mockResolvedValue({});
    const result = await controller.getPatientStats(mockUser);
    expect(result).toEqual({});
    expect(serviceMock.getPatientStats).toHaveBeenCalledWith('u-1', mockUser);
  });

  it('getDoctorStats should delegate to medicalRecordsService.getDoctorStats', async () => {
    serviceMock.getDoctorStats.mockResolvedValue({});
    const result = await controller.getDoctorStats(mockUser);
    expect(result).toEqual({});
    expect(serviceMock.getDoctorStats).toHaveBeenCalledWith('u-1');
  });

  it('startSpecialistExamination should delegate to medicalRecordsService.startSpecialistExamination', async () => {
    serviceMock.startSpecialistExamination.mockResolvedValue({ success: true });
    const result = await controller.startSpecialistExamination(
      'vso-1',
      mockUser,
    );
    expect(result).toEqual({ success: true });
    expect(serviceMock.startSpecialistExamination).toHaveBeenCalledWith(
      'vso-1',
      'u-1',
    );
  });

  it('completeSpecialistExamination should delegate to medicalRecordsService.completeSpecialistExamination', async () => {
    const dto: CompleteSpecialistExamDto = { resultText: 'eye exam normal' };
    serviceMock.completeSpecialistExamination.mockResolvedValue({
      success: true,
    });
    const result = await controller.completeSpecialistExamination(
      'vso-1',
      dto,
      mockUser,
    );
    expect(result).toEqual({ success: true });
    expect(serviceMock.completeSpecialistExamination).toHaveBeenCalledWith(
      'vso-1',
      'u-1',
      dto,
    );
  });

  it('should propagate NotFoundException from saveSymptoms service', async () => {
    const dto: SaveSymptomsDto = {};
    serviceMock.saveSymptoms.mockRejectedValue(
      new NotFoundException('Record not found'),
    );
    await expect(controller.saveSymptoms('b-1', dto, mockUser)).rejects.toThrow(
      NotFoundException,
    );
  });

  it('should propagate ForbiddenException from orderServices service', async () => {
    const dto: OrderServicesDto = { items: [] };
    serviceMock.orderServices.mockRejectedValue(
      new ForbiddenException('Access denied'),
    );
    await expect(
      controller.orderServices('b-1', dto, mockUser),
    ).rejects.toThrow(ForbiddenException);
  });

  it('should propagate BadRequestException from savePrescription service', async () => {
    const dto: CreatePrescriptionDto = { items: [] };
    serviceMock.savePrescription.mockRejectedValue(
      new BadRequestException('Invalid items'),
    );
    await expect(
      controller.savePrescription('b-1', dto, mockUser),
    ).rejects.toThrow(BadRequestException);
  });
});
