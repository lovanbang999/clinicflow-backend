import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
} from '@nestjs/common';
import { Response } from 'express';
import { ApiResponse } from '../interfaces/api-response.interface';

type ApiResponseLike = {
  success: boolean;
  messageCode: string;
};

type HttpExceptionResponseObject = {
  message?: string | string[];
  error?: string;
  statusCode?: number;
};

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isHttpExceptionResponseObject(
  value: unknown,
): value is HttpExceptionResponseObject {
  if (!isObject(value)) return false;

  const msg = value.message;
  const err = value.error;

  const messageOk =
    msg === undefined ||
    typeof msg === 'string' ||
    (Array.isArray(msg) && msg.every((x) => typeof x === 'string'));

  const errorOk = err === undefined || typeof err === 'string';

  return messageOk && errorOk;
}

function isApiResponseLike(value: unknown): value is ApiResponseLike {
  return (
    isObject(value) &&
    typeof value.success === 'boolean' &&
    typeof value.messageCode === 'string'
  );
}

@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const status = exception.getStatus();
    const exceptionResponse = exception.getResponse();

    // If response is already in our ApiResponse format, use it directly
    if (isApiResponseLike(exceptionResponse)) {
      response.status(status).json(exceptionResponse);
      return;
    }

    // Otherwise, format it to our standard
    let message = 'An error occurred';
    let errorMessage = 'Error';

    if (typeof exceptionResponse === 'string') {
      message = exceptionResponse;
      errorMessage = exceptionResponse;
    } else if (isHttpExceptionResponseObject(exceptionResponse)) {
      const msg = exceptionResponse.message;
      if (typeof msg === 'string') {
        message = msg;
      } else if (Array.isArray(msg) && msg.length > 0) {
        message = msg.join(', ');
      }

      if (typeof exceptionResponse.error === 'string') {
        errorMessage = exceptionResponse.error;
      }
    }

    const errorResponse: ApiResponse = {
      success: false,
      statusCode: status,
      message,
      messageCode: `HTTP.${status}`,
      errorMessage,
      errorCode: `HTTP.${status}`,
      timestamp: new Date().toISOString(),
    };

    response.status(status).json(errorResponse);
  }
}
