import { Test, TestingModule } from '@nestjs/testing';
import { LoggingInterceptor } from './logging.interceptor';
import { ExecutionContext, CallHandler, Logger } from '@nestjs/common';
import { of, throwError } from 'rxjs';

describe('LoggingInterceptor', () => {
  let interceptor: LoggingInterceptor;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [LoggingInterceptor],
    }).compile();

    interceptor = module.get<LoggingInterceptor>(LoggingInterceptor);
  });

  const createMockContext = (
    reqOverrides = {},
    resOverrides = {},
  ): ExecutionContext => {
    const request = {
      method: 'GET',
      originalUrl: '/test-route',
      ip: '127.0.0.1',
      get: jest.fn().mockReturnValue('mock-user-agent'),
      ...reqOverrides,
    };
    const response = {
      statusCode: 200,
      ...resOverrides,
    };
    return {
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: () => request,
        getResponse: () => response,
      }),
    } as unknown as ExecutionContext;
  };

  it('should be defined', () => {
    expect(interceptor).toBeDefined();
  });

  it('should call next.handle, measure execution time, and log successful requests', async () => {
    const context = createMockContext();
    const callHandler: CallHandler = {
      handle: () => of('result-data'),
    };

    const logSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation();

    const result$ = interceptor.intercept(context, callHandler);
    await result$.toPromise();

    expect(logSpy).toHaveBeenCalledWith(
      expect.stringMatching(
        /GET \/test-route 200 — \d+ms \[127\.0\.0\.1\] mock-user-agent/,
      ),
    );

    logSpy.mockRestore();
  });

  it('should log errors and rethrow them', async () => {
    const context = createMockContext();
    const errorInstance = new Error('Some database error');
    const callHandler: CallHandler = {
      handle: () => throwError(() => errorInstance),
    };

    const errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation();

    const result$ = interceptor.intercept(context, callHandler);

    await expect(result$.toPromise()).rejects.toThrow('Some database error');

    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringMatching(/GET \/test-route 500 — \d+ms \[127\.0\.0\.1\]/),
      errorInstance.stack,
    );

    errorSpy.mockRestore();
  });

  it('should use custom error status if present in error object', async () => {
    const context = createMockContext();
    const customError = { status: 403, message: 'Forbidden access' };
    const callHandler: CallHandler = {
      handle: () => throwError(() => customError),
    };

    const errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation();

    const result$ = interceptor.intercept(context, callHandler);

    await expect(result$.toPromise()).rejects.toEqual(customError);

    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringMatching(/GET \/test-route 403 — \d+ms \[127\.0\.0\.1\]/),
      '[object Object]',
    );

    errorSpy.mockRestore();
  });
});
