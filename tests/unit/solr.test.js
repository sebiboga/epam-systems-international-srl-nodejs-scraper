import { jest } from '@jest/globals';

describe('solr.js', () => {
  let solr;
  
  beforeAll(async () => {
    solr = await import('../../solr.js');
  });

  describe('querySOLR', () => {
    it('should return response object with docs', async () => {
      const result = await solr.querySOLR('33159615');
      
      expect(result).toHaveProperty('numFound');
      expect(result).toHaveProperty('docs');
      expect(Array.isArray(result.docs)).toBe(true);
    });

    it('should return jobs for specific CIF', async () => {
      const result = await solr.querySOLR('33159615');
      
      expect(result.numFound).toBeGreaterThan(0);
      expect(result.docs[0]).toHaveProperty('cif', '33159615');
    });
  });

  describe('queryCompanySOLR', () => {
    it('should return company data', async () => {
      const result = await solr.queryCompanySOLR('company:EPAM*');
      
      expect(result).toHaveProperty('numFound');
      expect(result.numFound).toBeGreaterThan(0);
      expect(result.docs[0]).toHaveProperty('brand', 'EPAM');
    });
  });

  describe('upsertJobs', () => {
    // SKIP - upsertJobs writes to PROD SOLR, only run manually when needed
    it.skip('should accept array of jobs', async () => {
      const testJob = {
        url: 'https://test.com/job1',
        title: 'Test Job',
        company: 'TEST COMPANY',
        cif: '12345678',
        status: 'scraped'
      };

      await expect(solr.upsertJobs([testJob])).resolves.not.toThrow();
    });
  });

  describe('getSolrAuth', () => {
    it('should return SOLR_AUTH from environment', () => {
      const auth = solr.getSolrAuth();
      
      expect(auth).toBeDefined();
      expect(typeof auth).toBe('string');
    });
  });

  describe('Data Integrity', () => {
    it('should not have duplicate URLs for same CIF', async () => {
      const result = await solr.querySOLR('33159615');
      
      const urls = result.docs.map(j => j.url);
      const uniqueUrls = new Set(urls);
      
      expect(uniqueUrls.size).toBe(result.numFound);
    });

    it('should have valid CIF format for all jobs', async () => {
      const result = await solr.querySOLR('33159615');
      
      for (const job of result.docs) {
        expect(job.cif).toMatch(/^\d{8}$/);
      }
    });

    it('should have valid status values', async () => {
      const result = await solr.querySOLR('33159615');
      const validStatuses = ['scraped', 'tested', 'verified', 'published'];
      
      for (const job of result.docs) {
        expect(validStatuses).toContain(job.status);
      }
    });
  });

  describe('Company Core Validation', () => {
    it('should have all required fields for EPAM in company core', async () => {
      const result = await solr.queryCompanySOLR('id:33159615');
      
      expect(result.numFound).toBe(1);
      const epam = result.docs[0];
      
      // Required fields
      expect(epam).toHaveProperty('id', '33159615');
      expect(epam).toHaveProperty('company');
      expect(epam.company).toBe('EPAM SYSTEMS INTERNATIONAL SRL');
      
      // Optional fields
      expect(epam).toHaveProperty('brand', 'EPAM');
      expect(epam).toHaveProperty('status', 'activ');
      expect(epam).toHaveProperty('location');
      expect(Array.isArray(epam.location)).toBe(true);
      expect(epam.location).toContain('Bucuresti');
      expect(epam).toHaveProperty('lastScraped');
      expect(epam.lastScraped).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(epam).toHaveProperty('scraperFile');
      expect(epam.scraperFile).toMatch(/^https:\/\/raw\.githubusercontent\.com\//);
    });

    it('should have optional fields for EPAM in company core', async () => {
      const result = await solr.queryCompanySOLR('id:33159615');
      const epam = result.docs[0];
      
      // These fields are optional but should be present
      expect(epam).toHaveProperty('group'); // optional
      
      // website and career are optional - check if they exist but are valid URLs
      if (epam.website) {
        expect(Array.isArray(epam.website)).toBe(true);
      }
      if (epam.career) {
        expect(Array.isArray(epam.career)).toBe(true);
      }
    });
  });
});