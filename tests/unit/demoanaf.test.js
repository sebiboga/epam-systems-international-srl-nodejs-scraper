import { jest } from '@jest/globals';

describe('demoanaf.js', () => {
  let demoanaf;
  
  beforeAll(async () => {
    demoanaf = await import('../../demoanaf.js');
  });

  describe('searchCompany', () => {
    it('should return array of companies for valid brand', async () => {
      const results = await demoanaf.searchCompany('EPAM');
      
      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBeGreaterThan(0);
      expect(results[0]).toHaveProperty('cui');
      expect(results[0]).toHaveProperty('name');
    });

    it('should return empty array for non-existent brand', async () => {
      const results = await demoanaf.searchCompany('NonExistentBrandXYZ123');
      
      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBe(0);
    });

    it('should include statusLabel in results', async () => {
      const results = await demoanaf.searchCompany('EPAM');
      
      expect(results[0]).toHaveProperty('statusLabel');
    });
  });

  describe('getCompanyFromANAF', () => {
    it('should return company data for valid CIF', async () => {
      const data = await demoanaf.getCompanyFromANAF('33159615');
      
      expect(data).toBeDefined();
      expect(data.cui).toBe(33159615);
      expect(data.name).toBe('EPAM SYSTEMS INTERNATIONAL SRL');
      expect(data).toHaveProperty('address');
      expect(data).toHaveProperty('registrationNumber');
    });

    it('should throw error for invalid CIF', async () => {
      await expect(demoanaf.getCompanyFromANAF('99999999')).rejects.toThrow();
    }, 15000);
  });
});