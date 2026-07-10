/* eslint-disable @typescript-eslint/unbound-method */
import { Test, TestingModule } from '@nestjs/testing';
import { AdminPatientsController } from './admin-patients.controller';
import { AdminPatientsService } from './admin-patients.service';
import { AdminCreatePatientDto } from './dto/create-patient.dto';
import { AdminUpdatePatientDto } from './dto/update-patient.dto';
import { PatientSearchQueryDto } from './dto/patient-query.dto';
import { Response } from 'express';
import { NotFoundException, ConflictException } from '@nestjs/common';
import { Gender } from '@prisma/client';

describe('AdminPatientsController', () => {
  let controller: AdminPatientsController;
  let serviceMock: Record<string, jest.Mock>;

  beforeEach(async () => {
    serviceMock = {
      create: jest.fn(),
      findAll: jest.fn(),
      exportToExcel: jest.fn(),
      getStats: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn(),
      getHealthProfile: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminPatientsController],
      providers: [{ provide: AdminPatientsService, useValue: serviceMock }],
    }).compile();

    controller = module.get<AdminPatientsController>(AdminPatientsController);
  });

  describe('create', () => {
    it('should forward DTO to service and return result', async () => {
      const dto: AdminCreatePatientDto = {
        email: 'patient@example.com',
        phone: '1234567890',
        fullName: 'Jane Doe',
        gender: Gender.FEMALE,
        dateOfBirth: '1995-05-05',
      };
      const expectedResult = { id: 'patient-123', ...dto };
      serviceMock.create.mockResolvedValue(expectedResult);

      const result = await controller.create(dto);

      expect(serviceMock.create).toHaveBeenCalledWith(dto);
      expect(result).toBe(expectedResult);
    });

    it('should propagate ConflictException from service', async () => {
      const dto: AdminCreatePatientDto = {
        email: 'patient@example.com',
        phone: '1234567890',
        fullName: 'Jane Doe',
        gender: Gender.FEMALE,
        dateOfBirth: '1995-05-05',
      };
      serviceMock.create.mockRejectedValue(
        new ConflictException('Email exists'),
      );

      await expect(controller.create(dto)).rejects.toThrow(ConflictException);
    });
  });

  describe('findAll', () => {
    it('should forward PatientSearchQueryDto to service and return result', async () => {
      const query: PatientSearchQueryDto = {
        search: 'Jane',
        gender: 'FEMALE',
        status: 'active',
        page: 1,
        limit: 10,
      };
      const expectedResult = { data: [], total: 0 };
      serviceMock.findAll.mockResolvedValue(expectedResult);

      const result = await controller.findAll(query);

      expect(serviceMock.findAll).toHaveBeenCalledWith(query);
      expect(result).toBe(expectedResult);
    });
  });

  describe('export', () => {
    it('should forward query to service, set spreadsheet headers, and write buffer response', async () => {
      const query: PatientSearchQueryDto = { search: 'test' };
      const mockBuffer = Buffer.from('excel-data');
      serviceMock.exportToExcel.mockResolvedValue(mockBuffer);

      const mockRes = {
        set: jest.fn(),
        end: jest.fn(),
      } as unknown as Response;

      await controller.export(query, mockRes);

      expect(serviceMock.exportToExcel).toHaveBeenCalledWith(query);
      expect(mockRes.set).toHaveBeenCalledWith({
        'Content-Type':
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename="patients.xlsx"',
        'Content-Length': mockBuffer.byteLength,
      });
      expect(mockRes.end).toHaveBeenCalledWith(mockBuffer);
    });
  });

  describe('getStats', () => {
    it('should call getStats on service and return value', async () => {
      const stats = { totalPatients: 100 };
      serviceMock.getStats.mockResolvedValue(stats);

      const result = await controller.getStats();

      expect(serviceMock.getStats).toHaveBeenCalled();
      expect(result).toBe(stats);
    });
  });

  describe('findOne', () => {
    it('should call findOne with id and return patient', async () => {
      const patientId = 'patient-uuid';
      const patient = { id: patientId, fullName: 'Jane Doe' };
      serviceMock.findOne.mockResolvedValue(patient);

      const result = await controller.findOne(patientId);

      expect(serviceMock.findOne).toHaveBeenCalledWith(patientId);
      expect(result).toBe(patient);
    });

    it('should propagate NotFoundException from service', async () => {
      const patientId = 'invalid-uuid';
      serviceMock.findOne.mockRejectedValue(new NotFoundException());

      await expect(controller.findOne(patientId)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('update', () => {
    it('should call update with id and dto and return updated patient', async () => {
      const patientId = 'patient-uuid';
      const dto: AdminUpdatePatientDto = { fullName: 'Jane Smith' };
      const updatedPatient = { id: patientId, fullName: 'Jane Smith' };
      serviceMock.update.mockResolvedValue(updatedPatient);

      const result = await controller.update(patientId, dto);

      expect(serviceMock.update).toHaveBeenCalledWith(patientId, dto);
      expect(result).toBe(updatedPatient);
    });

    it('should propagate NotFoundException from service during update', async () => {
      const patientId = 'invalid-uuid';
      const dto: AdminUpdatePatientDto = { fullName: 'Jane Smith' };
      serviceMock.update.mockRejectedValue(new NotFoundException());

      await expect(controller.update(patientId, dto)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getHealthProfile', () => {
    it('should call getHealthProfile with id and return value', async () => {
      const patientId = 'patient-uuid';
      const healthProfile = { bloodType: 'A+' };
      serviceMock.getHealthProfile.mockResolvedValue(healthProfile);

      const result = await controller.getHealthProfile(patientId);

      expect(serviceMock.getHealthProfile).toHaveBeenCalledWith(patientId);
      expect(result).toBe(healthProfile);
    });

    it('should propagate NotFoundException from health profile endpoint', async () => {
      const patientId = 'invalid-uuid';
      serviceMock.getHealthProfile.mockRejectedValue(new NotFoundException());

      await expect(controller.getHealthProfile(patientId)).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
