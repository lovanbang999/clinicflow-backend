import { HttpStatus } from '@nestjs/common';
import { PrismaExceptionFilter } from './prisma-exception.filter';
import { ArgumentsHost } from '@nestjs/common';
import { Prisma } from '@prisma/client';

interface MockResponse {
  status: jest.Mock;
  json: jest.Mock;
}

interface MockRequest {
  url: string;
}

interface ErrorResponseShape {
  statusCode: number;
  path: string;
  message: string;
  timestamp?: string;
}

describe('PrismaExceptionFilter', () => {
  let filter: PrismaExceptionFilter;
  let mockResponse: MockResponse;
  let mockRequest: MockRequest;
  let mockArgumentsHost: ArgumentsHost;

  beforeEach(() => {
    filter = new PrismaExceptionFilter();
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    mockRequest = {
      url: '/test-route',
    };
    mockArgumentsHost = {
      switchToHttp: jest.fn().mockReturnValue({
        getResponse: () => mockResponse,
        getRequest: () => mockRequest,
      }),
    } as unknown as ArgumentsHost;
  });

  function getJsonArg(): ErrorResponseShape {
    const [[firstArg]] = mockResponse.json.mock.calls as [[ErrorResponseShape]];
    return firstArg;
  }

  it('should map P2002 to 409 Conflict', () => {
    const error = new Prisma.PrismaClientKnownRequestError(
      'Unique constraint failed',
      {
        code: 'P2002',
        clientVersion: '5.0.0',
      },
    );

    filter.catch(error, mockArgumentsHost);

    expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.CONFLICT);
    const body = getJsonArg();
    expect(body.statusCode).toBe(HttpStatus.CONFLICT);
    expect(body.path).toBe('/test-route');
    expect(body.message).toBe('A record with this value already exists');
    expect(typeof body.timestamp).toBe('string');
  });

  it('should map P2025 to 404 Not Found', () => {
    const error = new Prisma.PrismaClientKnownRequestError('Record not found', {
      code: 'P2025',
      clientVersion: '5.0.0',
    });

    filter.catch(error, mockArgumentsHost);

    expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.NOT_FOUND);
    const body = getJsonArg();
    expect(body.statusCode).toBe(HttpStatus.NOT_FOUND);
    expect(body.path).toBe('/test-route');
    expect(body.message).toBe('Record not found');
    expect(typeof body.timestamp).toBe('string');
  });

  it('should map P2003 to 400 Bad Request', () => {
    const error = new Prisma.PrismaClientKnownRequestError(
      'Foreign key constraint failed',
      {
        code: 'P2003',
        clientVersion: '5.0.0',
      },
    );

    filter.catch(error, mockArgumentsHost);

    expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    const body = getJsonArg();
    expect(body.statusCode).toBe(HttpStatus.BAD_REQUEST);
    expect(body.path).toBe('/test-route');
    expect(body.message).toBe('Foreign key constraint failed');
    expect(typeof body.timestamp).toBe('string');
  });

  it('should fall back to 500 Internal Server Error for unknown Prisma codes', () => {
    const error = new Prisma.PrismaClientKnownRequestError(
      'Unknown database error',
      {
        code: 'P9999',
        clientVersion: '5.0.0',
      },
    );

    filter.catch(error, mockArgumentsHost);

    expect(mockResponse.status).toHaveBeenCalledWith(
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
    const body = getJsonArg();
    expect(body.statusCode).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(body.path).toBe('/test-route');
    expect(body.message).toBe('A database error occurred');
    expect(typeof body.timestamp).toBe('string');
  });
});
