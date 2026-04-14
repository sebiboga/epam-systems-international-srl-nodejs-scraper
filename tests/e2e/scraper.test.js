import { jest } from '@jest/globals';

describe('E2E: Full Scraping Workflow', () => {
  const TEST_CIF = '33159615';
  const TEST_BRAND = 'EPAM';

  it('should complete full workflow from brand to jobs in SOLR', async () => {
    const demoanaf = await import('../../demoanaf.js');
    const company = await import('../../company.js');
    const solr = await import('../../solr.js');
    const index = await import('../../index.js');
    
    const searchResults = await demoanaf.searchCompany(TEST_BRAND);
    expect(searchResults.length).toBeGreaterThan(0);
    
    const exactMatch = searchResults.find(c => 
      c.name.toUpperCase().startsWith(TEST_BRAND + ' ') &&
      c.statusLabel === 'Funcțiune'
    );
    expect(exactMatch).toBeDefined();
    expect(exactMatch.cui.toString()).toBe(TEST_CIF);
    
    const anafData = await demoanaf.getCompanyFromANAF(TEST_CIF);
    expect(anafData).toBeDefined();
    expect(anafData.inactive).toBe(false);
    
    const companyResult = await company.validateAndGetCompany();
    expect(companyResult.status).toBe('active');
    expect(companyResult.cif).toBe(TEST_CIF);
    
    const solrResult = await solr.querySOLR(TEST_CIF);
    expect(solrResult.numFound).toBeGreaterThan(0);
    
const companySolr = await solr.queryCompanySOLR(`brand:${TEST_BRAND}`);
      expect(companySolr.docs[0]).toHaveProperty('brand');
  });

  it('should handle inactive company gracefully', async () => {
    const demoanaf = await import('../../demoanaf.js');
    
    const searchResults = await demoanaf.searchCompany('InactiveCompany');
    const inactiveCompany = searchResults.find(c => c.statusLabel !== 'Funcțiune');
    
    if (inactiveCompany) {
      const anafData = await demoanaf.getCompanyFromANAF(inactiveCompany.cui.toString());
      expect(anafData.inactive).toBe(true);
    }
  });
});