import { Test, TestingModule } from '@nestjs/testing';
import { TransformInterceptor } from './transform.interceptor';
import { Reflector } from '@nestjs/core';
import { ExecutionContext, CallHandler } from '@nestjs/common';
import { firstValueFrom, of } from 'rxjs';

interface MockResponse {
  statusCode: number;
}

interface ApiResponse {
  success: boolean;
  statusCode: number;
  message: string;
  messageCode: string;
  data: unknown;
  timestamp: string;
}

describe('TransformInterceptor', () => {
  let interceptor: TransformInterceptor<unknown>;
  let reflector: Reflector;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TransformInterceptor,
        {
          provide: Reflector,
          useValue: {
            getAllAndOverride: jest.fn(),
          },
        },
      ],
    }).compile();

    interceptor =
      module.get<TransformInterceptor<unknown>>(TransformInterceptor);
    reflector = module.get<Reflector>(Reflector);
  });

  const createMockContext = (statusCode = 200): ExecutionContext => {
    const response: MockResponse = { statusCode };
    return {
      getHandler: jest.fn(),
      getClass: jest.fn(),
      switchToHttp: jest.fn().mockReturnValue({
        getResponse: () => response,
      }),
    } as unknown as ExecutionContext;
  };

  async function intercept(
    context: ExecutionContext,
    callHandler: CallHandler,
  ): Promise<ApiResponse> {
    return firstValueFrom(
      interceptor.intercept(context, callHandler),
    ) as Promise<ApiResponse>;
  }

  it('should be defined', () => {
    expect(interceptor).toBeDefined();
  });

  it('should wrap a successful raw response in standard ApiResponse structure', async () => {
    const context = createMockContext(200);
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue({
      messageCode: 'GET_SUCCESS',
      message: 'Resource retrieved',
    });

    const callHandler: CallHandler = {
      handle: () => of({ foo: 'bar' }),
    };

    const result = await intercept(context, callHandler);

    expect(result.success).toBe(true);
    expect(result.statusCode).toBe(200);
    expect(result.message).toBe('Resource retrieved');
    expect(result.messageCode).toBe('GET_SUCCESS');
    expect(result.data).toEqual({ foo: 'bar' });
    expect(typeof result.timestamp).toBe('string');
  });

  it('should handle undefined response by returning data as null', async () => {
    const context = createMockContext(201);
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);

    const callHandler: CallHandler = {
      handle: () => of(undefined),
    };

    const result = await intercept(context, callHandler);

    expect(result.success).toBe(true);
    expect(result.statusCode).toBe(201);
    expect(result.message).toBe('Operation successful');
    expect(result.messageCode).toBe('SUCCESS');
    expect(result.data).toBeNull();
    expect(typeof result.timestamp).toBe('string');
  });

  it('should pass through response unmodified if it is already formatted as ApiResponse', async () => {
    const context = createMockContext(200);
    const preformattedResponse = {
      success: true,
      statusCode: 200,
      message: 'Already custom formatted',
      messageCode: 'CUSTOM_STATUS',
      data: { hello: 'world' },
    };

    const callHandler: CallHandler = {
      handle: () => of(preformattedResponse),
    };

    const result = await intercept(context, callHandler);

    expect(result.success).toBe(true);
    expect(result.statusCode).toBe(200);
    expect(result.message).toBe('Already custom formatted');
    expect(result.messageCode).toBe('CUSTOM_STATUS');
    expect(result.data).toEqual({ hello: 'world' });
    expect(typeof result.timestamp).toBe('string');
  });

  it('should correctly format paginated responses', async () => {
    const context = createMockContext(200);
    const rawPaginatedData = {
      items: [{ id: 1 }, { id: 2 }],
      total: 10,
      page: 1,
      limit: 2,
      extraField: 'extraValue',
    };

    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);

    const callHandler: CallHandler = {
      handle: () => of(rawPaginatedData),
    };

    const result = await intercept(context, callHandler);

    expect(result.success).toBe(true);
    expect(result.statusCode).toBe(200);
    expect(result.message).toBe('Operation successful');
    expect(result.messageCode).toBe('SUCCESS');
    expect(result.data).toEqual({
      extraField: 'extraValue',
      items: [{ id: 1 }, { id: 2 }],
      pagination: {
        total: 10,
        page: 1,
        limit: 2,
        totalPages: 5,
      },
    });
    expect(typeof result.timestamp).toBe('string');
  });
});
