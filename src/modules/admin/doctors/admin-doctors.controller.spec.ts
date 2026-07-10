import { Test, TestingModule } from '@nestjs/testing';
import { AdminDoctorsController } from './admin-doctors.controller';
import { AdminDoctorsService } from './admin-doctors.service';
import { FilterDoctorDto } from './dto/filter-doctor.dto';
import { AdminCreateDoctorDto } from './dto/admin-create-doctor.dto';
import { AdminUpdateDoctorProfileDto } from './dto/admin-update-doctor-profile.dto';
import { AdminSuspendUserDto } from '../users/dto/admin-suspend-user.dto';
import { NotFoundException, ConflictException } from '@nestjs/common';

describe('AdminDoctorsController', () => {
  let controller: AdminDoctorsController;
  let serviceMock: Record<string, jest.Mock>;

  beforeEach(async () => {
    serviceMock = {
      getDoctorStatistics: jest.fn(),
      findAllDoctors: jest.fn(),
      createDoctor: jest.fn(),
      findOneDoctor: jest.fn(),
      updateDoctorProfile: jest.fn(),
      toggleDoctorActive: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminDoctorsController],
      providers: [{ provide: AdminDoctorsService, useValue: serviceMock }],
    }).compile();

    controller = module.get<AdminDoctorsController>(AdminDoctorsController);
  });

  describe('getDoctorStatistics', () => {
    it('should call getDoctorStatistics on service and return value', async () => {
      const stats = { totalDoctors: 10 };
      serviceMock.getDoctorStatistics.mockResolvedValue(stats);

      const result = await controller.getDoctorStatistics();

      expect(serviceMock.getDoctorStatistics).toHaveBeenCalled();
      expect(result).toBe(stats);
    });
  });

  describe('getDoctors', () => {
    it('should forward filterDto to service and return result', async () => {
      const filterDto: FilterDoctorDto = {
        specialty: 'Cardiology',
        isActive: true,
        search: 'Dr. John',
        page: 1,
        limit: 10,
      };
      const expectedResult = { doctors: [], total: 0 };
      serviceMock.findAllDoctors.mockResolvedValue(expectedResult);

      const result = await controller.getDoctors(filterDto);

      expect(serviceMock.findAllDoctors).toHaveBeenCalledWith(filterDto);
      expect(result).toBe(expectedResult);
    });
  });

  describe('createDoctor', () => {
    it('should forward dto to service and return created doctor', async () => {
      const dto: AdminCreateDoctorDto = {
        email: 'doctor@example.com',
        phone: '1234567890',
        fullName: 'Dr. Jane Smith',
        password: 'SecurePass123!',
      };
      const expectedResult = { id: 'doc-123', ...dto };
      serviceMock.createDoctor.mockResolvedValue(expectedResult);

      const result = await controller.createDoctor(dto);

      expect(serviceMock.createDoctor).toHaveBeenCalledWith(dto);
      expect(result).toBe(expectedResult);
    });

    it('should propagate ConflictException from service', async () => {
      const dto: AdminCreateDoctorDto = {
        email: 'doctor@example.com',
        phone: '1234567890',
        fullName: 'Dr. Jane Smith',
        password: 'SecurePass123!',
      };
      serviceMock.createDoctor.mockRejectedValue(
        new ConflictException('Email exists'),
      );

      await expect(controller.createDoctor(dto)).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('getDoctorById', () => {
    it('should call findOneDoctor with id and return value', async () => {
      const docId = 'doc-uuid';
      const doctor = { id: docId, fullName: 'Dr. Jane Smith' };
      serviceMock.findOneDoctor.mockResolvedValue(doctor);

      const result = await controller.getDoctorById(docId);

      expect(serviceMock.findOneDoctor).toHaveBeenCalledWith(docId);
      expect(result).toBe(doctor);
    });

    it('should propagate NotFoundException from service', async () => {
      const docId = 'invalid-uuid';
      serviceMock.findOneDoctor.mockRejectedValue(new NotFoundException());

      await expect(controller.getDoctorById(docId)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('updateDoctorProfile', () => {
    it('should forward id and dto to service and return result', async () => {
      const docId = 'doc-uuid';
      const dto: AdminUpdateDoctorProfileDto = {
        specialties: ['Cardiology'],
        qualifications: ['MD'],
        yearsOfExperience: 10,
        bio: 'Experienced cardiologist',
      };
      const expectedResult = { id: docId, profile: dto };
      serviceMock.updateDoctorProfile.mockResolvedValue(expectedResult);

      const result = await controller.updateDoctorProfile(docId, dto);

      expect(serviceMock.updateDoctorProfile).toHaveBeenCalledWith(docId, dto);
      expect(result).toBe(expectedResult);
    });

    it('should propagate NotFoundException from service during profile update', async () => {
      const docId = 'invalid-uuid';
      const dto: AdminUpdateDoctorProfileDto = { specialties: ['Cardiology'] };
      serviceMock.updateDoctorProfile.mockRejectedValue(
        new NotFoundException(),
      );

      await expect(controller.updateDoctorProfile(docId, dto)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('toggleDoctorStatus', () => {
    it('should forward id and dto to service and return result', async () => {
      const docId = 'doc-uuid';
      const dto: AdminSuspendUserDto = {
        isActive: false,
        reason: 'Violation of policy',
      };
      const expectedResult = { id: docId, isActive: false };
      serviceMock.toggleDoctorActive.mockResolvedValue(expectedResult);

      const result = await controller.toggleDoctorStatus(docId, dto);

      expect(serviceMock.toggleDoctorActive).toHaveBeenCalledWith(docId, dto);
      expect(result).toBe(expectedResult);
    });

    it('should propagate NotFoundException from service during status toggle', async () => {
      const docId = 'invalid-uuid';
      const dto: AdminSuspendUserDto = { isActive: false };
      serviceMock.toggleDoctorActive.mockRejectedValue(new NotFoundException());

      await expect(controller.toggleDoctorStatus(docId, dto)).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
