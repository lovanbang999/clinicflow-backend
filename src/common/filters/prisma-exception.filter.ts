import { ArgumentsHost, Catch, HttpStatus } from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';
import { Prisma } from '@prisma/client';
import { Response } from 'express';

@Catch(Prisma.PrismaClientKnownRequestError)
export class PrismaExceptionFilter extends BaseExceptionFilter {
  catch(exception: Prisma.PrismaClientKnownRequestError, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';

    switch (exception.code) {
      case 'P2002':
        // Unique constraint violation
        status = HttpStatus.CONFLICT;
        message = 'A record with this value already exists';
        break;
      case 'P2025':
        // Record not found
        status = HttpStatus.NOT_FOUND;
        message = 'Record not found';
        break;
      case 'P2003':
        // Foreign key constraint failed
        status = HttpStatus.BAD_REQUEST;
        message = 'Foreign key constraint failed';
        break;
      default:
        // Unknown Prisma error
        status = HttpStatus.INTERNAL_SERVER_ERROR;
        message = exception.message;
    }

    response.status(status).json({
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      message,
    });
  }
}
