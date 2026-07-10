import { Test, TestingModule } from '@nestjs/testing';
import { SuggestionsController } from './suggestions.controller';
import { SuggestionsService } from './suggestions.service';
import { SmartSuggestionsQueryDto } from './dto/smart-suggestions-query.dto';
import { BadRequestException } from '@nestjs/common';

describe('SuggestionsController', () => {
  let controller: SuggestionsController;
  let serviceMock: Record<string, jest.Mock>;

  beforeEach(async () => {
    serviceMock = {
      getSuggestions: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [SuggestionsController],
      providers: [{ provide: SuggestionsService, useValue: serviceMock }],
    }).compile();

    controller = module.get<SuggestionsController>(SuggestionsController);
  });

  describe('getSuggestions', () => {
    it('should forward SmartSuggestionsQueryDto to service and return result', async () => {
      const query: SmartSuggestionsQueryDto = {
        doctorId: 'doc-123',
        serviceId: 'srv-123',
        startDate: '2026-07-20',
        endDate: '2026-07-25',
        limit: 5,
        preferMorning: true,
        preferAfternoon: false,
        earliestTime: '08:00',
        latestTime: '17:00',
      };
      const expectedResult = { suggestions: [], totalFound: 0 };
      serviceMock.getSuggestions.mockResolvedValue(expectedResult);

      const result = await controller.getSuggestions(query);

      expect(serviceMock.getSuggestions).toHaveBeenCalledWith(query);
      expect(result).toBe(expectedResult);
    });

    it('should handle empty suggestions list returned from service', async () => {
      const query: SmartSuggestionsQueryDto = {
        doctorId: 'doc-123',
        serviceId: 'srv-123',
        startDate: '2026-07-20',
        endDate: '2026-07-25',
      };
      const expectedResult = { suggestions: [], totalFound: 0 };
      serviceMock.getSuggestions.mockResolvedValue(expectedResult);

      const result = await controller.getSuggestions(query);

      expect(result).toEqual(expectedResult);
    });

    it('should propagate BadRequestException from service', async () => {
      const query: SmartSuggestionsQueryDto = {
        doctorId: 'doc-123',
        serviceId: 'srv-123',
        startDate: 'invalid-date',
        endDate: '2026-07-25',
      };
      serviceMock.getSuggestions.mockRejectedValue(
        new BadRequestException('Invalid start date'),
      );

      await expect(controller.getSuggestions(query)).rejects.toThrow(
        BadRequestException,
      );
    });
  });
});
