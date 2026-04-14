import { jest } from '@jest/globals';

describe('Integration: API Workflow', () => {
  
  describe('Full company validation workflow', () => {
    it.skip('should go from brand to validated company (ANAF API can return 500)', async () => {
      const demoanaf = await import('../../demoanaf.js');
      const company = await import('../../company.js');
      const solr = await import('../../solr.js');
      
      const searchResults = await demoanaf.searchCompany('EPAM');
      expect(searchResults.length).toBeGreaterThan(0);
      
      const epamCompany = searchResults.find(c => 
        c.name.toUpperCase().includes('EPAM') && c.statusLabel === 'Funcțiune'
      );
      expect(epamCompany).toBeDefined();
      
      const anafData = await demoanaf.getCompanyFromANAF(epamCompany.cui.toString());
      expect(anafData.name).toBe('EPAM SYSTEMS INTERNATIONAL SRL');
      
      const companyResult = await company.validateAndGetCompany();
      expect(companyResult.status).toBe('active');
      expect(companyResult.cif).toBe('33159615');
      
      const solrResult = await solr.querySOLR(companyResult.cif);
      expect(solrResult.numFound).toBeGreaterThan(0);
    });
  });

describe('Company data consistency', () => {
    it('should have matching data across ANAF, Peviitor and SOLR', async () => {
      const company = await import('../../company.js');
      const solr = await import('../../solr.js');
      
      const companyResult = await company.validateAndGetCompany();
      
      const solrResult = await solr.queryCompanySOLR(`company:${companyResult.company}*`);
      expect(solrResult.docs[0].brand).toBe('EPAM');
    });
  });

  describe('Company Core Model Validation', () => {
    it('should have all required fields per company model', async () => {
      const solr = await import('../../solr.js');
      
      const result = await solr.queryCompanySOLR('id:33159615');
      expect(result.numFound).toBe(1);
      
      const epam = result.docs[0];
      
      // Required: id, company
      expect(epam.id).toBe('33159615');
      expect(epam.company).toBeDefined();
      
      // All other model fields should exist per company-model.md
      expect(epam.brand).toBe('EPAM');
      expect(epam.status).toBeDefined();
      expect(['activ','suspendat','inactiv','radiat']).toContain(epam.status);
      expect(epam.location).toBeDefined();
      expect(Array.isArray(epam.location)).toBe(true);
      expect(epam.lastScraped).toBeDefined();
      expect(epam.scraperFile).toBeDefined();
    });
  });
});
  });
});