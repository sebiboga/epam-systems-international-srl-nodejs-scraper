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
    it('should accept array of jobs', async () => {
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
});