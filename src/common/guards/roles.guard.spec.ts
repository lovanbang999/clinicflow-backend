import { Test, TestingModule } from '@nestjs/testing';
import { RolesGuard } from './roles.guard';
import { Reflector } from '@nestjs/core';
import { ExecutionContext } from '@nestjs/common';
import { UserRole } from '@prisma/client';

interface MockUser {
  role: UserRole;
}

describe('RolesGuard', () => {
  let guard: RolesGuard;
  let reflector: Reflector;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RolesGuard,
        {
          provide: Reflector,
          useValue: {
            getAllAndOverride: jest.fn(),
          },
        },
      ],
    }).compile();

    guard = module.get<RolesGuard>(RolesGuard);
    reflector = module.get<Reflector>(Reflector);
  });

  const createMockContext = (user?: MockUser): ExecutionContext => {
    const request = { user };
    return {
      getHandler: jest.fn(),
      getClass: jest.fn(),
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: jest.fn().mockReturnValue(request),
      }),
    } as unknown as ExecutionContext;
  };

  it('should be defined', () => {
    expect(guard).toBeDefined();
  });

  it('should allow access if route is marked public', () => {
    const context = createMockContext();
    reflector.getAllAndOverride = jest
      .fn()
      .mockImplementation((key: string) => {
        if (key === 'isPublic') return true;
        return undefined;
      });

    const result = guard.canActivate(context);
    expect(result).toBe(true);
  });

  it('should deny access if there is no user', () => {
    const context = createMockContext(undefined);
    reflector.getAllAndOverride = jest
      .fn()
      .mockImplementation((key: string) => {
        if (key === 'isPublic') return false;
        return undefined;
      });

    const result = guard.canActivate(context);
    expect(result).toBe(false);
  });

  it('should allow access if user role matches one of the required roles', () => {
    const context = createMockContext({ role: UserRole.DOCTOR });
    reflector.getAllAndOverride = jest
      .fn()
      .mockImplementation((key: string) => {
        if (key === 'isPublic') return false;
        if (key === 'roles') return [UserRole.DOCTOR, UserRole.ADMIN];
        return undefined;
      });

    const result = guard.canActivate(context);
    expect(result).toBe(true);
  });

  it('should deny access if user role does not match required roles', () => {
    const context = createMockContext({ role: UserRole.PATIENT });
    reflector.getAllAndOverride = jest
      .fn()
      .mockImplementation((key: string) => {
        if (key === 'isPublic') return false;
        if (key === 'roles') return [UserRole.DOCTOR, UserRole.ADMIN];
        return undefined;
      });

    const result = guard.canActivate(context);
    expect(result).toBe(false);
  });

  it('should allow access if marked as authenticated only and user is present', () => {
    const context = createMockContext({ role: UserRole.PATIENT });
    reflector.getAllAndOverride = jest
      .fn()
      .mockImplementation((key: string) => {
        if (key === 'isPublic') return false;
        if (key === 'roles') return undefined;
        if (key === 'isAuthenticatedOnly') return true;
        return undefined;
      });

    const result = guard.canActivate(context);
    expect(result).toBe(true);
  });

  it('should deny access (deny by default fallback) if no roles/auth/public metadata is set', () => {
    const context = createMockContext({ role: UserRole.PATIENT });
    reflector.getAllAndOverride = jest
      .fn()
      .mockImplementation((key: string) => {
        if (key === 'isPublic') return false;
        if (key === 'roles') return undefined;
        if (key === 'isAuthenticatedOnly') return undefined;
        return undefined;
      });

    const result = guard.canActivate(context);
    expect(result).toBe(false);
  });
});
