import { jest } from '@jest/globals';

const mockFetch = jest.fn();

jest.unstable_mockModule('node-fetch', () => ({
  default: mockFetch
}));

function makeSolrResponse(numFound, docs) {
  return {
    ok: true,
    json: async () => ({ response: { numFound, docs } })
  };
}

function makeErrorResponse(status, text) {
  return {
    ok: false,
    status,
    text: async () => text
  };
}

describe('solr.js', () => {
  let solr;

  beforeAll(async () => {
    process.env.SOLR_AUTH = 'test:test';
    solr = await import('../../solr.js');
  });

  afterAll(() => {
    delete process.env.SOLR_AUTH;
  });

  beforeEach(() => {
    mockFetch.mockReset();
  });

  describe('getSolrAuth', () => {
    it('should return SOLR_AUTH from environment', () => {
      const auth = solr.getSolrAuth();
      expect(auth).toBe('test:test');
    });

    it('should return undefined when not set', () => {
      delete process.env.SOLR_AUTH;
      const auth = solr.getSolrAuth();
      expect(auth).toBeUndefined();
      process.env.SOLR_AUTH = 'test:test';
    });
  });

  describe('querySOLR', () => {
    it('should return response object with docs', async () => {
      mockFetch.mockResolvedValue(makeSolrResponse(2, [
        { id: 'job1', url: 'https://test.com/1', cif: '33159615' },
        { id: 'job2', url: 'https://test.com/2', cif: '33159615' }
      ]));

      const result = await solr.querySOLR('33159615');

      expect(result).toHaveProperty('numFound', 2);
      expect(result).toHaveProperty('docs');
      expect(Array.isArray(result.docs)).toBe(true);
      expect(result.docs).toHaveLength(2);
    });

    it('should return empty docs when no jobs found', async () => {
      mockFetch.mockResolvedValue(makeSolrResponse(0, []));

      const result = await solr.querySOLR('99999999');

      expect(result.numFound).toBe(0);
      expect(result.docs).toEqual([]);
    });

    it('should throw when SOLR_AUTH is missing', async () => {
      delete process.env.SOLR_AUTH;
      await expect(solr.querySOLR('33159615')).rejects.toThrow('SOLR_AUTH not set in environment');
      process.env.SOLR_AUTH = 'test:test';
    });

    it('should throw on HTTP error', async () => {
      mockFetch.mockResolvedValue(makeErrorResponse(500, 'Internal Server Error'));

      await expect(solr.querySOLR('33159615')).rejects.toThrow('SOLR query error: 500');
    });
  });

  describe('queryCompanySOLR', () => {
    it('should return company data', async () => {
      mockFetch.mockResolvedValue(makeSolrResponse(1, [
        { id: '33159615', company: 'EPAM SYSTEMS INTERNATIONAL SRL', brand: 'EPAM' }
      ]));

      const result = await solr.queryCompanySOLR('id:33159615');

      expect(result.numFound).toBe(1);
      expect(result.docs[0].brand).toBe('EPAM');
    });

    it('should return empty when company not found', async () => {
      mockFetch.mockResolvedValue(makeSolrResponse(0, []));

      const result = await solr.queryCompanySOLR('id:00000000');

      expect(result.numFound).toBe(0);
    });

    it('should throw on HTTP error', async () => {
      mockFetch.mockResolvedValue(makeErrorResponse(401, 'Unauthorized'));

      await expect(solr.queryCompanySOLR('id:33159615')).rejects.toThrow('SOLR company query error: 401');
    });
  });

  describe('upsertJobs', () => {
    it('should accept array of jobs', async () => {
      mockFetch.mockResolvedValue(makeSolrResponse(0, []));

      const testJob = {
        url: 'https://test.com/job1',
        title: 'Test Job',
        company: 'TEST COMPANY',
        cif: '12345678',
        status: 'scraped'
      };

      await expect(solr.upsertJobs([testJob])).resolves.not.toThrow();
    });

    it('should throw on HTTP error', async () => {
      mockFetch.mockResolvedValue(makeErrorResponse(400, 'Bad Request'));

      await expect(solr.upsertJobs([{ url: 'https://test.com/bad' }])).rejects.toThrow('SOLR upsert error: 400');
    });

    it('should throw when SOLR_AUTH is missing', async () => {
      delete process.env.SOLR_AUTH;
      await expect(solr.upsertJobs([])).rejects.toThrow('SOLR_AUTH not set in environment');
      process.env.SOLR_AUTH = 'test:test';
    });
  });

  describe('deleteJobByUrl', () => {
    it('should delete a job by URL', async () => {
      mockFetch.mockResolvedValue(makeSolrResponse(0, []));

      await expect(solr.deleteJobByUrl('https://test.com/old-job')).resolves.not.toThrow();
    });

    it('should throw on HTTP error', async () => {
      mockFetch.mockResolvedValue(makeErrorResponse(500, 'Error'));

      await expect(solr.deleteJobByUrl('https://test.com/bad')).rejects.toThrow('SOLR delete error: 500');
    });
  });

  describe('deleteJobsByCIF', () => {
    it('should delete all jobs for a CIF', async () => {
      mockFetch.mockResolvedValue(makeSolrResponse(0, []));

      await expect(solr.deleteJobsByCIF('33159615')).resolves.not.toThrow();
    });

    it('should throw on HTTP error', async () => {
      mockFetch.mockResolvedValue(makeErrorResponse(500, 'Error'));

      await expect(solr.deleteJobsByCIF('33159615')).rejects.toThrow('SOLR delete error: 500');
    });
  });

  describe('Data Integrity', () => {
    it('should not have duplicate URLs for same CIF', async () => {
      mockFetch.mockResolvedValue(makeSolrResponse(2, [
        { url: 'https://test.com/job1', title: 'Job 1', cif: '33159615' },
        { url: 'https://test.com/job2', title: 'Job 2', cif: '33159615' }
      ]));

      const result = await solr.querySOLR('33159615');
      const urls = result.docs.map(j => j.url);
      const uniqueUrls = new Set(urls);

      expect(uniqueUrls.size).toBe(result.numFound);
    });

    it('should have valid CIF format for all jobs', async () => {
      mockFetch.mockResolvedValue(makeSolrResponse(2, [
        { url: 'https://test.com/1', title: 'Job 1', cif: '33159615' },
        { url: 'https://test.com/2', title: 'Job 2', cif: '12345678' }
      ]));

      const result = await solr.querySOLR('33159615');

      for (const job of result.docs) {
        expect(job.cif).toMatch(/^\d{8}$/);
      }
    });

    it('should detect invalid CIF format', async () => {
      mockFetch.mockResolvedValue(makeSolrResponse(1, [
        { url: 'https://test.com/1', title: 'Job 1', cif: 'abc' }
      ]));

      const result = await solr.querySOLR('abc');

      for (const job of result.docs) {
        expect(job.cif).not.toMatch(/^\d{8}$/);
      }
    });

    it('should have valid status values', async () => {
      const validStatuses = ['scraped', 'tested', 'verified', 'published'];

      mockFetch.mockResolvedValue(makeSolrResponse(3, [
        { url: 'https://test.com/1', title: 'Job 1', cif: '33159615', status: 'scraped' },
        { url: 'https://test.com/2', title: 'Job 2', cif: '33159615', status: 'verified' },
        { url: 'https://test.com/3', title: 'Job 3', cif: '33159615', status: 'published' }
      ]));

      const result = await solr.querySOLR('33159615');

      for (const job of result.docs) {
        expect(validStatuses).toContain(job.status);
      }
    });
  });
});
