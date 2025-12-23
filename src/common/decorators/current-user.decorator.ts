import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';

type AuthUser = Express.User;

type CurrentUserDecorator = {
  (): ParameterDecorator;
  <K extends keyof AuthUser>(key: K): ParameterDecorator;
};

export const CurrentUser = createParamDecorator(
  (key: keyof AuthUser | undefined, ctx: ExecutionContext) => {
    const req = ctx.switchToHttp().getRequest<Request>();
    const user = req.user;

    if (!user) return undefined;

    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return key ? user[key] : user;
  },
) as CurrentUserDecorator;
