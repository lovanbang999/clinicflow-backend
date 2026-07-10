import { HttpException, HttpStatus } from '@nestjs/common';
import { HttpExceptionFilter } from './http-exception.filter';
import { ArgumentsHost } from '@nestjs/common';

interface MockResponse {
  status: jest.Mock;
  json: jest.Mock;
}

interface ApiResponseShape {
  success: boolean;
  statusCode: number;
  message: string;
  messageCode: string;
  errorMessage?: string;
  errorCode?: string;
  timestamp?: string;
}

describe('HttpExceptionFilter', () => {
  let filter: HttpExceptionFilter;
  let mockResponse: MockResponse;
  let mockArgumentsHost: ArgumentsHost;

  beforeEach(() => {
    filter = new HttpExceptionFilter();
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    mockArgumentsHost = {
      switchToHttp: jest.fn().mockReturnValue({
        getResponse: () => mockResponse,
        getRequest: () => ({ url: '/test-path' }),
      }),
    } as unknown as ArgumentsHost;
  });

  function getJsonArg(): ApiResponseShape {
    const [[firstArg]] = mockResponse.json.mock.calls as [[ApiResponseShape]];
    return firstArg;
  }

  it('should format HttpException with string response correctly', () => {
    const exception = new HttpException(
      'Test error message',
      HttpStatus.BAD_REQUEST,
    );

    filter.catch(exception, mockArgumentsHost);

    expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    const body = getJsonArg();
    expect(body.success).toBe(false);
    expect(body.statusCode).toBe(HttpStatus.BAD_REQUEST);
    expect(body.message).toBe('Test error message');
    expect(body.messageCode).toBe('HTTP.400');
    expect(body.errorMessage).toBe('Test error message');
    expect(body.errorCode).toBe('HTTP.400');
    expect(typeof body.timestamp).toBe('string');
  });

  it('should format HttpException with object response correctly', () => {
    const exception = new HttpException(
      { message: 'Invalid field value', error: 'Bad Request' },
      HttpStatus.BAD_REQUEST,
    );

    filter.catch(exception, mockArgumentsHost);

    expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    const body = getJsonArg();
    expect(body.success).toBe(false);
    expect(body.statusCode).toBe(HttpStatus.BAD_REQUEST);
    expect(body.message).toBe('Invalid field value');
    expect(body.messageCode).toBe('HTTP.400');
    expect(body.errorMessage).toBe('Bad Request');
    expect(body.errorCode).toBe('HTTP.400');
    expect(typeof body.timestamp).toBe('string');
  });

  it('should format HttpException with array of messages correctly', () => {
    const exception = new HttpException(
      {
        message: ['email must be an email', 'password is too short'],
        error: 'Bad Request',
      },
      HttpStatus.BAD_REQUEST,
    );

    filter.catch(exception, mockArgumentsHost);

    expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    const body = getJsonArg();
    expect(body.success).toBe(false);
    expect(body.statusCode).toBe(HttpStatus.BAD_REQUEST);
    expect(body.message).toBe('email must be an email, password is too short');
    expect(body.messageCode).toBe('HTTP.400');
    expect(body.errorMessage).toBe('Bad Request');
    expect(body.errorCode).toBe('HTTP.400');
    expect(typeof body.timestamp).toBe('string');
  });

  it('should pass through response directly if it already fits ApiResponse format', () => {
    const apiResponsePayload = {
      success: false,
      statusCode: HttpStatus.UNAUTHORIZED,
      message: 'Custom unauthorized message',
      messageCode: 'AUTH_FAILED',
    };
    const exception = new HttpException(
      apiResponsePayload,
      HttpStatus.UNAUTHORIZED,
    );

    filter.catch(exception, mockArgumentsHost);

    expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.UNAUTHORIZED);
    expect(mockResponse.json).toHaveBeenCalledWith(apiResponsePayload);
  });
});
