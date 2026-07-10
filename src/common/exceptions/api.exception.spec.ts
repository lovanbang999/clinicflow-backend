import { HttpStatus } from '@nestjs/common';
import { ApiException } from './api.exception';

interface ApiResponse {
  success: boolean;
  statusCode: number;
  message: string;
  messageCode: string;
  errorMessage: string;
  errorCode: string;
  timestamp: string;
}

describe('ApiException', () => {
  it('should create an instance of ApiException with custom properties', () => {
    const errorCode = 'AUTH_001';
    const errorMessage = 'Invalid username or password';
    const statusCode = HttpStatus.UNAUTHORIZED;
    const message = 'Authentication failed';

    const exception = new ApiException(
      errorCode,
      errorMessage,
      statusCode,
      message,
    );

    expect(exception.getStatus()).toBe(HttpStatus.UNAUTHORIZED);

    const response = exception.getResponse() as ApiResponse;
    expect(response).toEqual(
      expect.objectContaining({
        success: false,
        statusCode: HttpStatus.UNAUTHORIZED,
        message: 'Authentication failed',
        messageCode: 'AUTH_001',
        errorMessage: 'Invalid username or password',
        errorCode: 'AUTH_001',
        timestamp: expect.any(String) as unknown as string,
      }),
    );
  });

  it('should use default status BAD_REQUEST and default message if not specified', () => {
    const errorCode = 'ERR_001';
    const errorMessage = 'Something went wrong';

    const exception = new ApiException(errorCode, errorMessage);

    expect(exception.getStatus()).toBe(HttpStatus.BAD_REQUEST);

    const response = exception.getResponse() as ApiResponse;
    expect(response.message).toBe('Operation failed');
  });
});
