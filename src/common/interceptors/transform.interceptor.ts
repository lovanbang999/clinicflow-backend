import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { Response } from 'express';
import { ApiResponse } from '../interfaces/api-response.interface';
import {
  RESPONSE_MESSAGE_METADATA,
  ResponseMessageOptions,
} from '../decorators/response-message.decorator';

interface ExpectedApiResponse {
  success: boolean;
  statusCode: number;
  message: string;
  messageCode: string;
  data?: unknown;
  errorMessage?: string;
  errorCode?: string;
  timestamp?: string;
}

interface ExpectedPaginatedData {
  items: unknown[];
  total: unknown;
  page: unknown;
  limit: unknown;
}

@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<
  T,
  ApiResponse<unknown>
> {
  constructor(private reflector: Reflector) {}

  intercept(
    context: ExecutionContext,
    next: CallHandler<T>,
  ): Observable<ApiResponse<unknown>> {
    const ctx = context.switchToHttp();
    const response = ctx.getResponse<Response>();
    const statusCode = response.statusCode || 200;

    // Retrieve the custom message and code from the @ResponseMessage decorator
    const responseMessage =
      this.reflector.getAllAndOverride<ResponseMessageOptions>(
        RESPONSE_MESSAGE_METADATA,
        [context.getHandler(), context.getClass()],
      );

    const messageCode = responseMessage?.messageCode || 'SUCCESS';
    const message = responseMessage?.message || 'Operation successful';

    return next.handle().pipe(
      map((data: unknown): ApiResponse<unknown> => {
        // If data is already in our standard ApiResponse format (backward-compatibility), pass it through directly
        const isApiResponse = (val: unknown): val is ExpectedApiResponse => {
          return (
            val !== null &&
            typeof val === 'object' &&
            'success' in val &&
            'statusCode' in val &&
            'message' in val &&
            'messageCode' in val
          );
        };

        if (isApiResponse(data)) {
          return {
            success: data.success,
            statusCode: data.statusCode,
            message: data.message,
            messageCode: data.messageCode,
            data: data.data,
            errorMessage: data.errorMessage,
            errorCode: data.errorCode,
            timestamp: data.timestamp || new Date().toISOString(),
          };
        }

        // If data represents a raw paginated result that hasn't been formatted yet
        const isPaginatedData = (
          val: unknown,
        ): val is ExpectedPaginatedData => {
          return (
            val !== null &&
            typeof val === 'object' &&
            'items' in val &&
            'total' in val &&
            'page' in val &&
            'limit' in val
          );
        };

        if (isPaginatedData(data)) {
          const total = Number(data.total);
          const page = Number(data.page);
          const limit = Number(data.limit);
          const totalPages = Math.ceil(total / limit) || 1;

          // Separate items, total, page, limit from other potential keys
          const paginatedData = data as ExpectedPaginatedData & Record<string, unknown>;
          const items = paginatedData.items;
          const extraKeys = { ...paginatedData } as Partial<ExpectedPaginatedData> & Record<string, unknown>;
          delete extraKeys.items;
          delete extraKeys.total;
          delete extraKeys.page;
          delete extraKeys.limit;

          return {
            success: true,
            statusCode,
            message,
            messageCode,
            data: {
              ...extraKeys,
              items: items,
              pagination: {
                total,
                page,
                limit,
                totalPages,
              },
            },
            timestamp: new Date().toISOString(),
          };
        }

        // Default standard wrapping
        return {
          success: true,
          statusCode,
          message,
          messageCode,
          data: data !== undefined ? data : null,
          timestamp: new Date().toISOString(),
        };
      }),
    );
  }
}
