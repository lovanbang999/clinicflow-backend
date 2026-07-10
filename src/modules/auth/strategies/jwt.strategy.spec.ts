import { Test, TestingModule } from '@nestjs/testing';
import { JwtStrategy } from './jwt.strategy';
import { ConfigService } from '@nestjs/config';
import { AuthService } from '../auth.service';
import { UnauthorizedException } from '@nestjs/common';

describe('JwtStrategy', () => {
  let strategy: JwtStrategy;
  let authServiceMock: Record<string, jest.Mock>;
  let configServiceMock: Record<string, jest.Mock>;

  beforeEach(async () => {
    authServiceMock = {
      validateUser: jest.fn(),
    };
    configServiceMock = {
      getOrThrow: jest.fn().mockReturnValue('mock-secret'),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JwtStrategy,
        { provide: AuthService, useValue: authServiceMock },
        { provide: ConfigService, useValue: configServiceMock },
      ],
    }).compile();

    strategy = module.get<JwtStrategy>(JwtStrategy);
  });

  it('should be defined', () => {
    expect(strategy).toBeDefined();
  });

  describe('validate', () => {
    it('should return the user if validation succeeds', async () => {
      const mockPayload = { sub: 'user-123', email: 'test@clinic.com' };
      const mockUser = {
        id: 'user-123',
        email: 'test@clinic.com',
        role: 'DOCTOR',
      };
      authServiceMock.validateUser.mockResolvedValue(mockUser);

      const result = await strategy.validate(mockPayload);

      expect(authServiceMock.validateUser).toHaveBeenCalledWith('user-123');
      expect(result).toEqual(mockUser);
    });

    it('should throw UnauthorizedException if user does not exist or is inactive', async () => {
      const mockPayload = { sub: 'user-123', email: 'test@clinic.com' };
      authServiceMock.validateUser.mockResolvedValue(null);

      await expect(strategy.validate(mockPayload)).rejects.toThrow(
        UnauthorizedException,
      );
      expect(authServiceMock.validateUser).toHaveBeenCalledWith('user-123');
    });
  });
});
