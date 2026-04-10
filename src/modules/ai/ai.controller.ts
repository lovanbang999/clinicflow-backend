import {
  Controller,
  Post,
  Patch,
  Body,
  Param,
  UseGuards,
  Res,
  HttpCode,
  HttpStatus,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { AiService } from './ai.service';
import { AiSessionService } from './ai-session.service';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { AiSessionOutcome } from '@prisma/client';
import { Response } from 'express';
import { PatientContext } from './ai.provider';
import {
  I_PROFILE_REPOSITORY,
  IProfileRepository,
} from '../database/interfaces/profile.repository.interface';
import { Inject } from '@nestjs/common';

@Controller('ai')
@UseGuards(JwtAuthGuard)
export class AiController {
  constructor(
    private readonly aiService: AiService,
    private readonly aiSessionService: AiSessionService,
    @Inject(I_PROFILE_REPOSITORY)
    private readonly profileRepository: IProfileRepository,
  ) {}

  /**
   * POST /ai/chat
   * - Fetches patient profile to build personalized system prompt.
   * - If sessionId is provided in body, reuses the existing session.
   * - Otherwise creates a new session and returns its ID via X-Session-Id header.
   */
  @Post('chat')
  async chatStream(
    @Body('history') history: any[] = [],
    @Body('message') message: string,
    @Body('sessionId') incomingSessionId: string | undefined,
    @CurrentUser() user: { id: string },
    @Res() res: Response,
  ) {
    // Resolve or create session
    let sessionId = incomingSessionId;
    if (!sessionId) {
      sessionId = await this.aiSessionService.createSession(user.id);
    }

    // Fetch patient profile for context and booking tool
    let patientContext: PatientContext | undefined;
    let patientProfileId: string = user.id; // Fallback to userId if profile not found
    try {
      const profile = await this.profileRepository.findFirstPatientProfile({
        where: { userId: user.id },
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

      if (profile) {
        // patientProfileId is passed separately for booking tool — NOT user.id
        patientProfileId = profile.id;
        patientContext = {
          fullName: profile.fullName,
          gender: profile.gender,
          dateOfBirth: profile.dateOfBirth ?? undefined,
          bloodType: profile.bloodType,
          allergies: profile.allergies,
          chronicConditions: profile.chronicConditions,
        };
      }
    } catch {
      // Profile fetch failure should not block the chat
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Session-Id', sessionId);

    const subscription = this.aiService
      .chatStream(
        history,
        message,
        patientProfileId,
        user.id, // Pass userId for auditing
        sessionId,
        patientContext,
      )
      .subscribe({
        next: (data: unknown) => {
          res.write(`data: ${JSON.stringify(data)}\n\n`);
        },
        error: (e: unknown) => {
          const errMessage = e instanceof Error ? e.message : 'Unknown error';
          res.write(`data: ${JSON.stringify({ error: errMessage })}\n\n`);
          res.end();
        },
        complete: () => {
          res.end();
        },
      });

    res.on('close', () => {
      subscription.unsubscribe();
    });
  }

  /**
   * PATCH /ai/session/:id/end
   * Called by frontend when user clicks "New Chat" — marks session as ABANDONED.
   */
  @Patch('session/:id/end')
  @HttpCode(HttpStatus.NO_CONTENT)
  async endSession(
    @Param('id') sessionId: string,
    @CurrentUser() user: { id: string },
  ) {
    const owns = await this.aiSessionService.ownsSession(sessionId, user.id);
    if (!owns)
      throw new ForbiddenException('Session not found or access denied');

    await this.aiSessionService.endSession(
      sessionId,
      AiSessionOutcome.ABANDONED,
    );
  }

  /**
   * POST /ai/session/:id/report
   * Called by frontend when user clicks "Report Issue".
   */
  @Post('session/:id/report')
  @HttpCode(HttpStatus.NO_CONTENT)
  async reportSession(
    @Param('id') sessionId: string,
    @Body('note') note: string | undefined,
    @CurrentUser() user: { id: string },
  ) {
    const owns = await this.aiSessionService.ownsSession(sessionId, user.id);
    if (!owns)
      throw new NotFoundException('Session not found or access denied');

    await this.aiSessionService.reportSession(sessionId, note);
  }
}
