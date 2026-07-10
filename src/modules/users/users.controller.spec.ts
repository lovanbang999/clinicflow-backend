import { Test, TestingModule } from '@nestjs/testing';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { NotFoundException, ConflictException } from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import {
  RegisterPatientDto,
  CreateGuestPatientDto,
} from './dto/quick-create-patient.dto';
import { UpdatePatientProfileDto } from './dto/update-patient-profile.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { FilterUserDto } from './dto/filter-user.dto';
import { FilterPatientDto } from './dto/filter-patient.dto';
import { UserRole, Gender } from '@prisma/client';

describe('UsersController', () => {
  let controller: UsersController;
  let serviceMock: Record<string, jest.Mock>;

  beforeEach(async () => {
    serviceMock = {
      findPublicDoctors: jest.fn(),
      findPublicDoctor: jest.fn(),
      create: jest.fn(),
      registerPatient: jest.fn(),
      createGuestPatient: jest.fn(),
      findAllPatients: jest.fn(),
      getPatientsStats: jest.fn(),
      updatePatientProfile: jest.fn(),
      findAll: jest.fn(),
      getTechnicians: jest.fn(),
      addTechnicianSpecialization: jest.fn(),
      removeTechnicianSpecialization: jest.fn(),
      getStatistics: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn(),
      changePassword: jest.fn(),
      remove: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [
        {
          provide: UsersService,
          useValue: serviceMock,
        },
      ],
    }).compile();

    controller = module.get<UsersController>(UsersController);
  });

  it('getPublicDoctors should delegate to findPublicDoctors with queries', async () => {
    serviceMock.findPublicDoctors.mockResolvedValue([]);
    const result = await controller.getPublicDoctors('s-1', 2, 10);
    expect(result).toEqual([]);
    expect(serviceMock.findPublicDoctors).toHaveBeenCalledWith({
      serviceId: 's-1',
      page: 2,
      limit: 10,
    });
  });

  it('getPublicDoctor should delegate to findPublicDoctor', async () => {
    serviceMock.findPublicDoctor.mockResolvedValue({ id: 'doc-1' });
    const result = await controller.getPublicDoctor('doc-1');
    expect(result).toEqual({ id: 'doc-1' });
    expect(serviceMock.findPublicDoctor).toHaveBeenCalledWith('doc-1');
  });

  it('create should delegate to create with createUserDto', async () => {
    const dto: CreateUserDto = {
      email: 'doctor@clinic.com',
      password: 'password123',
      fullName: 'Dr. House',
      role: UserRole.DOCTOR,
    };
    serviceMock.create.mockResolvedValue({ id: 'u-1' });
    const result = await controller.create(dto);
    expect(result).toEqual({ id: 'u-1' });
    expect(serviceMock.create).toHaveBeenCalledWith(dto);
  });

  it('registerPatient should delegate to registerPatient with dto', async () => {
    const dto: RegisterPatientDto = {
      email: 'pat@clinic.com',
      fullName: 'Alice',
      phone: '0901234567',
      gender: Gender.FEMALE,
      dateOfBirth: '2000-01-01',
      address: 'Hanoi',
    };
    serviceMock.registerPatient.mockResolvedValue({ id: 'p-1' });
    const result = await controller.registerPatient(dto);
    expect(result).toEqual({ id: 'p-1' });
    expect(serviceMock.registerPatient).toHaveBeenCalledWith(dto);
  });

  it('createGuestPatient should delegate to createGuestPatient with dto', async () => {
    const dto: CreateGuestPatientDto = {
      fullName: 'Bob',
      phone: '0901234568',
      gender: Gender.MALE,
      dateOfBirth: '1990-01-01',
      address: 'Da Nang',
    };
    serviceMock.createGuestPatient.mockResolvedValue({ id: 'p-2' });
    const result = await controller.createGuestPatient(dto);
    expect(result).toEqual({ id: 'p-2' });
    expect(serviceMock.createGuestPatient).toHaveBeenCalledWith(dto);
  });

  it('findAllPatients should delegate to findAllPatients with query dto', async () => {
    const dto: FilterPatientDto = { search: 'Bob', page: 1, limit: 10 };
    serviceMock.findAllPatients.mockResolvedValue([]);
    const result = await controller.findAllPatients(dto);
    expect(result).toEqual([]);
    expect(serviceMock.findAllPatients).toHaveBeenCalledWith(dto);
  });

  it('getPatientsStats should delegate to getPatientsStats', async () => {
    serviceMock.getPatientsStats.mockResolvedValue({ total: 100 });
    const result = await controller.getPatientsStats();
    expect(result).toEqual({ total: 100 });
    expect(serviceMock.getPatientsStats).toHaveBeenCalled();
  });

  it('updatePatientProfile should delegate to updatePatientProfile with id and dto', async () => {
    const dto: UpdatePatientProfileDto = { fullName: 'Bob Updated' };
    serviceMock.updatePatientProfile.mockResolvedValue({ id: 'p-2' });
    const result = await controller.updatePatientProfile('p-2', dto);
    expect(result).toEqual({ id: 'p-2' });
    expect(serviceMock.updatePatientProfile).toHaveBeenCalledWith('p-2', dto);
  });

  it('findAll should delegate to findAll with filter dto', async () => {
    const dto: FilterUserDto = { search: 'Dr', page: 1, limit: 5 };
    serviceMock.findAll.mockResolvedValue([]);
    const result = await controller.findAll(dto);
    expect(result).toEqual([]);
    expect(serviceMock.findAll).toHaveBeenCalledWith(dto);
  });

  it('getTechnicians should delegate to getTechnicians', async () => {
    serviceMock.getTechnicians.mockResolvedValue([]);
    const result = await controller.getTechnicians('cat-1');
    expect(result).toEqual([]);
    expect(serviceMock.getTechnicians).toHaveBeenCalledWith('cat-1');
  });

  it('addTechnicianSpecialization should delegate to addTechnicianSpecialization', async () => {
    serviceMock.addTechnicianSpecialization.mockResolvedValue({
      success: true,
    });
    const result = await controller.addTechnicianSpecialization('t-1', 'cat-1');
    expect(result).toEqual({ success: true });
    expect(serviceMock.addTechnicianSpecialization).toHaveBeenCalledWith(
      't-1',
      'cat-1',
    );
  });

  it('removeTechnicianSpecialization should delegate to removeTechnicianSpecialization', async () => {
    serviceMock.removeTechnicianSpecialization.mockResolvedValue({
      success: true,
    });
    const result = await controller.removeTechnicianSpecialization(
      't-1',
      'cat-1',
    );
    expect(result).toEqual({ success: true });
    expect(serviceMock.removeTechnicianSpecialization).toHaveBeenCalledWith(
      't-1',
      'cat-1',
    );
  });

  it('getStatistics should delegate to getStatistics', async () => {
    serviceMock.getStatistics.mockResolvedValue({ stats: {} });
    const result = await controller.getStatistics();
    expect(result).toEqual({ stats: {} });
    expect(serviceMock.getStatistics).toHaveBeenCalled();
  });

  it('getCurrentUser should delegate to findOne with current user id', async () => {
    serviceMock.findOne.mockResolvedValue({ id: 'u-1' });
    const result = await controller.getCurrentUser('u-1');
    expect(result).toEqual({ id: 'u-1' });
    expect(serviceMock.findOne).toHaveBeenCalledWith('u-1');
  });

  it('updateCurrentUser should delegate to update with safe fields only', async () => {
    const dto: UpdateUserDto = {
      fullName: 'Alice',
      email: 'alice@hacker.com',
      role: UserRole.ADMIN,
    };
    serviceMock.update.mockResolvedValue({ id: 'u-1' });
    const result = await controller.updateCurrentUser('u-1', dto);
    expect(result).toEqual({ id: 'u-1' });
    expect(serviceMock.update).toHaveBeenCalledWith('u-1', {
      fullName: 'Alice',
    });
  });

  it('changePassword should delegate to changePassword', async () => {
    const dto: ChangePasswordDto = {
      currentPassword: 'old',
      newPassword: 'newPassword123',
    };
    serviceMock.changePassword.mockResolvedValue({ success: true });
    const result = await controller.changePassword('u-1', dto);
    expect(result).toEqual({ success: true });
    expect(serviceMock.changePassword).toHaveBeenCalledWith('u-1', dto);
  });

  it('findOne should delegate to findOne with param id', async () => {
    serviceMock.findOne.mockResolvedValue({ id: 'u-2' });
    const result = await controller.findOne('u-2');
    expect(result).toEqual({ id: 'u-2' });
    expect(serviceMock.findOne).toHaveBeenCalledWith('u-2');
  });

  it('update should delegate to update with param id and dto', async () => {
    const dto: UpdateUserDto = { fullName: 'Bob' };
    serviceMock.update.mockResolvedValue({ id: 'u-2' });
    const result = await controller.update('u-2', dto);
    expect(result).toEqual({ id: 'u-2' });
    expect(serviceMock.update).toHaveBeenCalledWith('u-2', dto);
  });

  it('remove should delegate to remove', async () => {
    serviceMock.remove.mockResolvedValue({ success: true });
    const result = await controller.remove('u-2');
    expect(result).toEqual({ success: true });
    expect(serviceMock.remove).toHaveBeenCalledWith('u-2');
  });

  it('should propagate NotFoundException from findOne service', async () => {
    serviceMock.findOne.mockRejectedValue(
      new NotFoundException('User not found'),
    );
    await expect(controller.findOne('non-existent')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('should propagate ConflictException from create service', async () => {
    const dto: CreateUserDto = {
      email: 'duplicate@clinic.com',
      password: 'password123',
      fullName: 'Duplicate',
      role: UserRole.PATIENT,
    };
    serviceMock.create.mockRejectedValue(
      new ConflictException('Email already exists'),
    );
    await expect(controller.create(dto)).rejects.toThrow(ConflictException);
  });
});
