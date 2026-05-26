import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable, throwError } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { Request, Response } from 'express';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const ctx = context.switchToHttp();
    const req = ctx.getRequest<Request>();
    const res = ctx.getResponse<Response>();
    const { method, originalUrl, ip } = req;
    const userAgent = req.get('user-agent') ?? '';
    const start = Date.now();

    return next.handle().pipe(
      tap(() => {
        const ms = Date.now() - start;
        this.logger.log(
          `${method} ${originalUrl} ${res.statusCode} — ${ms}ms [${ip}] ${userAgent}`,
        );
      }),
      catchError((err: unknown) => {
        const ms = Date.now() - start;
        const status =
          err instanceof Object && 'status' in err
            ? (err as { status: number }).status
            : 500;
        this.logger.error(
          `${method} ${originalUrl} ${status} — ${ms}ms [${ip}]`,
          err instanceof Error ? err.stack : String(err),
        );
        return throwError(() => err);
      }),
    );
  }
}
