import { ExecutionContext } from '@nestjs/common';

// Typed shape of the @nestjs/common module we depend on in this test
interface NestCommonModule {
  createParamDecorator: (
    factory: (key: string | undefined, ctx: ExecutionContext) => unknown,
  ) => ReturnType<typeof import('@nestjs/common').createParamDecorator>;
  [key: string]: unknown;
}

let capturedFactory: (
  key: string | undefined,
  ctx: ExecutionContext,
) => unknown;

jest.mock('@nestjs/common', () => {
  const original = jest.requireActual<NestCommonModule>('@nestjs/common');
  return {
    ...original,
    createParamDecorator: (
      factory: (key: string | undefined, ctx: ExecutionContext) => unknown,
    ) => {
      capturedFactory = factory;
      return original.createParamDecorator(factory);
    },
  };
});

import { CurrentUser } from './current-user.decorator';

describe('CurrentUser Decorator', () => {
  it('should be defined', () => {
    expect(CurrentUser).toBeDefined();
    expect(capturedFactory).toBeDefined();
  });

  interface MockRequest {
    user?: Record<string, unknown>;
  }

  const createMockContext = (
    user?: Record<string, unknown>,
  ): ExecutionContext => {
    const request: MockRequest = { user };
    return {
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: () => request,
      }),
    } as unknown as ExecutionContext;
  };

  it('should return undefined if there is no user in the request', () => {
    const ctx = createMockContext(undefined);
    const result = capturedFactory(undefined, ctx);
    expect(result).toBeUndefined();
  });

  it('should return the full user object if no key is provided', () => {
    const userPayload = {
      id: 'user-123',
      email: 'test@clinic.com',
      role: 'DOCTOR',
    };
    const ctx = createMockContext(userPayload);
    const result = capturedFactory(undefined, ctx);
    expect(result).toEqual(userPayload);
  });

  it('should return the specific property of the user if key is provided', () => {
    const userPayload = {
      id: 'user-123',
      email: 'test@clinic.com',
      role: 'DOCTOR',
    };
    const ctx = createMockContext(userPayload);
    const result = capturedFactory('email', ctx);
    expect(result).toBe('test@clinic.com');
  });
});
