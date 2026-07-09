import { UserRole, Gender } from '@prisma/client';

export interface UserFilterInput {
  role?: UserRole;
  isActive?: boolean;
  isVerified?: boolean;
  search?: string;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface PatientFilterInput {
  search?: string;
  isGuest?: boolean;
  gender?: string;
  bloodType?: string;
  status?: string;
  page?: number;
  limit?: number;
}

export interface CreateUserPayload {
  email: string;
  password?: string;
  fullName: string;
  phone?: string;
  role: UserRole;
  isActive?: boolean;
  isVerified?: boolean;
  isPasswordTemp?: boolean;
  dateOfBirth?: Date;
  gender?: Gender;
  address?: string;
  specialties?: string[];
  qualifications?: string[];
  bio?: string | null;
  yearsOfExperience?: number;
  consultationFee?: number | null;
}

export interface UpdateUserPayload {
  email?: string;
  fullName?: string;
  phone?: string;
  gender?: Gender;
  dateOfBirth?: string | Date | null;
  address?: string;
  role?: UserRole;
  isActive?: boolean;
  lockReason?: string | null;
  password?: string;
  isPasswordTemp?: boolean;
  avatar?: string;
  // PatientProfile fields
  bloodType?: string;
  heightCm?: number;
  weightKg?: number;
  allergies?: string;
  chronicConditions?: string;
}
