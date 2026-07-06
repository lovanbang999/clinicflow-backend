import {
  Controller,
  Post,
  Patch,
  Get,
  Body,
  Param,
  Query,
  UseGuards,
  Res,
  HttpCode,
  HttpStatus,
  ForbiddenException,
  NotFoundException,
  Inject,
} from '@nestjs/common';
import { Response } from 'express';
import { AiSessionOutcome } from '@prisma/client';
import { AiService } from './ai.service';
import { AiSessionService } from './ai-session.service';
import { PatientContext } from './ai.provider';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { ResponseMessage } from 'src/common/decorators/response-message.decorator';
import { MessageCodes } from 'src/common/constants/message-codes.const';
import {
  I_PROFILE_REPOSITORY,
  IProfileRepository,
} from '../database/interfaces/profile.repository.interface';

@Controller('ai')
@UseGuards(JwtAuthGuard)
export class AiController {
  constructor(
    private readonly aiService: AiService,
    private readonly aiSessionService: AiSessionService,
    @Inject(I_PROFILE_REPOSITORY)
    private readonly profileRepository: IProfileRepository,
  ) {}

  @Post('chat')
  async chatStream(
    @Body('history') history: unknown[] = [],
    @Body('message') message: string,
    @Body('sessionId') incomingSessionId: string | undefined,
    @CurrentUser() user: { id: string },
    @Res() res: Response,
  ) {
    const sessionId =
      incomingSessionId ?? (await this.aiSessionService.createSession(user.id));
    const { context, profileId } = await this.resolvePatientContext(user.id);

    this.initSseHeaders(res, sessionId);

    const subscription = this.aiService
      .chatStream(history, message, profileId, user.id, sessionId, context)
      .subscribe({
        next: (data: unknown) => res.write(`data: ${JSON.stringify(data)}\n\n`),
        error: (e: unknown) => {
          const errMessage = e instanceof Error ? e.message : 'Unknown error';
          res.write(`data: ${JSON.stringify({ error: errMessage })}\n\n`);
          res.end();
        },
        complete: () => res.end(),
      });

    res.on('close', () => subscription.unsubscribe());
  }

  @Patch('session/:id/end')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ResponseMessage(MessageCodes.AI_SESSION_ENDED, 'Session ended successfully')
  async endSession(
    @Param('id') sessionId: string,
    @CurrentUser() user: { id: string },
  ) {
    await this.assertSessionOwnership(sessionId, user.id);
    await this.aiSessionService.endSession(
      sessionId,
      AiSessionOutcome.ABANDONED,
    );
  }

  @Post('session/:id/report')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ResponseMessage(
    MessageCodes.AI_REPORT_CREATED,
    'Issue reported successfully',
  )
  async reportSession(
    @Param('id') sessionId: string,
    @Body('note') note: string | undefined,
    @CurrentUser() user: { id: string },
  ) {
    await this.assertSessionOwnership(sessionId, user.id);
    await this.aiSessionService.reportSession(sessionId, note);
  }

  @Get('sessions')
  async listSessions(
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '20',
    @CurrentUser() user: { id: string },
  ) {
    const result = await this.aiSessionService.listSessions(
      user.id,
      parseInt(page, 10) || 1,
      parseInt(limit, 10) || 20,
    );
    return { data: result.sessions, meta: { total: result.total } };
  }

  @Get('session/:id/messages')
  async getSessionMessages(
    @Param('id') sessionId: string,
    @CurrentUser() user: { id: string },
  ) {
    const result = await this.aiSessionService.getSessionMessages(
      sessionId,
      user.id,
    );
    if (!result)
      throw new NotFoundException('Session not found or access denied');
    return { data: result };
  }

  // ─── Private Helpers ───────────────────────────────────────────────────────

  private async resolvePatientContext(
    userId: string,
  ): Promise<{ context: PatientContext | undefined; profileId: string }> {
    try {
      const profile = await this.profileRepository.findFirstPatientProfile({
        where: { userId },
        select: {
          id: true,
          fullName: true,
          gender: true,
          dateOfBirth: true,
          bloodType: true,
          allergies: true,
          chronicConditions: true,
        },
      });

      if (!profile) return { context: undefined, profileId: userId };

      return {
        profileId: profile.id,
        context: {
          fullName: profile.fullName,
          gender: profile.gender,
          dateOfBirth: profile.dateOfBirth ?? undefined,
          bloodType: profile.bloodType,
          allergies: profile.allergies,
          chronicConditions: profile.chronicConditions,
        },
      };
    } catch {
      return { context: undefined, profileId: userId };
    }
  }

  private initSseHeaders(res: Response, sessionId: string): void {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Session-Id', sessionId);
  }

  private async assertSessionOwnership(
    sessionId: string,
    userId: string,
  ): Promise<void> {
    const owns = await this.aiSessionService.ownsSession(sessionId, userId);
    if (!owns)
      throw new ForbiddenException('Session not found or access denied');
  }
}
