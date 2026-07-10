import { SpecialtyTool } from './specialty.tool';
import { I_CATALOG_REPOSITORY } from '../../database/interfaces/catalog.repository.interface';

describe('SpecialtyTool', () => {
  let tool: SpecialtyTool;
  let mockCatalogRepository: { findManyCategory: jest.Mock };

  beforeEach(() => {
    mockCatalogRepository = { findManyCategory: jest.fn() };
    tool = new SpecialtyTool(mockCatalogRepository as never);
    Object.defineProperty(tool, I_CATALOG_REPOSITORY, {
      value: mockCatalogRepository,
      writable: true,
    });
  });

  function makeCategory(id: string, name: string) {
    return {
      id,
      name,
      description: `Description of ${name}`,
      services: [
        {
          id: `svc-${id}`,
          name: `Service for ${name}`,
          serviceCode: `SVC-${id}`,
          price: 150000,
          durationMinutes: 30,
          tags: ['exam'],
        },
      ],
    };
  }

  describe('execute', () => {
    it('should query with symptom keyword filter and return matchedByKeyword=true', async () => {
      const mockResult = [makeCategory('1', 'Nhi khoa')];
      mockCatalogRepository.findManyCategory.mockResolvedValue(mockResult);

      const result = await tool.execute({ symptoms: 'sốt' });

      expect(result).toMatchObject({
        matchedByKeyword: true,
        symptomQuery: 'sốt',
        specialties: mockResult,
      });

      const firstCall = (
        mockCatalogRepository.findManyCategory.mock.calls as unknown[][]
      )[0][0] as {
        where: { OR?: unknown };
      };
      expect(firstCall.where.OR).toBeDefined();
    });

    it('should query all examination specialties if no match is found by keyword', async () => {
      // First call (keyword) returns empty
      mockCatalogRepository.findManyCategory.mockResolvedValueOnce([]);
      // Second call (all specialties fallback) returns a list
      const fallbackResult = [
        makeCategory('1', 'Nội khoa'),
        makeCategory('2', 'Nhi khoa'),
      ];
      mockCatalogRepository.findManyCategory.mockResolvedValueOnce(
        fallbackResult,
      );

      const result = await tool.execute({ symptoms: 'cough' });

      expect(result).toMatchObject({
        matchedByKeyword: false,
        symptomQuery: 'cough',
        specialties: fallbackResult,
      });

      expect(mockCatalogRepository.findManyCategory).toHaveBeenCalledTimes(2);
    });

    it('should query all examination specialties directly if symptoms is empty string', async () => {
      const fallbackResult = [makeCategory('1', 'Nội khoa')];
      mockCatalogRepository.findManyCategory.mockResolvedValue(fallbackResult);

      const result = await tool.execute({ symptoms: '' });

      expect(result).toMatchObject({
        matchedByKeyword: false,
        symptomQuery: '',
        specialties: fallbackResult,
      });

      expect(mockCatalogRepository.findManyCategory).toHaveBeenCalledTimes(1);
      const call = (
        mockCatalogRepository.findManyCategory.mock.calls as unknown[][]
      )[0][0] as {
        where: { OR?: unknown };
      };
      expect(call.where.OR).toBeUndefined();
    });
  });
});
