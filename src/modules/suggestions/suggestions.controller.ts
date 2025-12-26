import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { SuggestionsService } from './suggestions.service';
import { SmartSuggestionsQueryDto } from './dto/smart-suggestions-query.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@ApiTags('suggestions')
@Controller('suggestions')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT-auth')
export class SuggestionsController {
  constructor(private readonly suggestionsService: SuggestionsService) {}

  @Get('smart')
  @ApiOperation({
    summary: 'Get smart time slot suggestions',
    description:
      'Returns intelligent time slot suggestions based on availability, time preferences, and optimization scoring',
  })
  @ApiQuery({ name: 'doctorId', required: true })
  @ApiQuery({ name: 'serviceId', required: true })
  @ApiQuery({ name: 'startDate', required: true, example: '2024-12-26' })
  @ApiQuery({ name: 'endDate', required: true, example: '2024-12-31' })
  @ApiQuery({ name: 'limit', required: false, example: 5 })
  @ApiQuery({ name: 'preferMorning', required: false, example: false })
  @ApiQuery({ name: 'preferAfternoon', required: false, example: false })
  @ApiQuery({ name: 'earliestTime', required: false, example: '08:00' })
  @ApiQuery({ name: 'latestTime', required: false, example: '17:00' })
  @ApiResponse({
    status: 200,
    description: 'Smart suggestions returned successfully',
    schema: {
      example: {
        suggestions: [
          {
            date: '2024-12-26',
            dayOfWeek: 'THURSDAY',
            time: '09:00',
            availableSlots: 3,
            score: 18,
            reasons: [
              'Fully available',
              'Morning slot (preferred)',
              'Mid-morning (optimal)',
              'Available soon',
            ],
          },
          {
            date: '2024-12-26',
            dayOfWeek: 'THURSDAY',
            time: '09:30',
            availableSlots: 3,
            score: 17,
            reasons: [
              'Fully available',
              'Morning slot',
              'Mid-morning (optimal)',
              'Available soon',
            ],
          },
        ],
        totalFound: 45,
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid query parameters',
  })
  getSuggestions(@Query() queryDto: SmartSuggestionsQueryDto) {
    return this.suggestionsService.getSuggestions(queryDto);
  }
}
