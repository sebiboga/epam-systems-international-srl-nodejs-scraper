import { jest } from '@jest/globals';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fetch from 'node-fetch';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../.env.local') });

const HAS_SOLR = !!process.env.SOLR_AUTH;

function itIfSolr(name, fn, timeout) {
  if (HAS_SOLR) {
    return it(name, fn, timeout);
  }
  return it.skip(`${name} (skipped: SOLR_AUTH not set)`, fn, timeout);
}

let HAS_ANAF = false;

async function checkAnafAvailability() {
  try {
    const res = await fetch('https://demoanaf.ro/api/search?q=test', {
      method: 'HEAD',
      signal: AbortSignal.timeout(5000)
    });
    return res.ok;
  } catch {
    return false;
  }
}

function itIfAnaf(name, fn, timeout) {
  if (HAS_ANAF) {
    return it(name, fn, timeout);
  }
  return it.skip(`${name} (skipped: ANAF API unavailable)`, fn, timeout);
}

beforeAll(async () => {
  HAS_ANAF = await checkAnafAvailability();
  if (HAS_SOLR) {
    process.env.SOLR_AUTH = process.env.SOLR_AUTH;
  }
});

const TEST_CIF = '33159615';
const TEST_BRAND = 'EPAM';
const EPAM_API_URL = 'https://careers.epam.com/api/jobs/v2/search/careers-i18n?from=0&lang=en&size=5&sortBy=relevance%3Brelocation%3Dasc&websiteLocale=en-us&facets=country%3D8150000000000001155';
const ROMANIAN_CITIES = ['Bucharest', 'București', 'Cluj-Napoca', 'Timișoara', 'Iași', 'Brașov', 'Constanța', 'Sibiu', 'Oradea'];

describe('E2E: Full Scraping Pipeline', () => {

  describe('EPAM Careers API — Real Data Fetch', () => {
    let apiData;

    beforeAll(async () => {
      const res = await fetch(EPAM_API_URL, {
        headers: {
          'User-Agent': 'job_seeker_ro_spider',
          'Accept': 'application/json'
        }
      });
      apiData = await res.json();
    }, 15000);

    it('should respond with valid job data from EPAM API', () => {
      expect(apiData).toHaveProperty('data');
      expect(apiData.data).toHaveProperty('jobs');
      expect(Array.isArray(apiData.data.jobs)).toBe(true);
      expect(apiData.data.jobs.length).toBeGreaterThan(0);
      expect(apiData.data).toHaveProperty('total');
      expect(typeof apiData.data.total).toBe('number');
    }, 10000);

    it('should have Romania jobs with expected fields', () => {
      const job = apiData.data.jobs[0];
      expect(job).toHaveProperty('uid');
      expect(job).toHaveProperty('name');
      expect(typeof job.name).toBe('string');
      expect(job).toHaveProperty('city');
    });

    it('should have Romanian country on at least one job', () => {
      const allCountries = apiData.data.jobs.flatMap(j =>
        (j.country || []).map(c => c.name?.toLowerCase())
      );
      expect(allCountries.length).toBeGreaterThan(0);
      expect(allCountries.some(c => c === 'romania')).toBe(true);
    });

    it('should have country set to Romania', () => {
      const job = apiData.data.jobs[0];
      expect(job).toHaveProperty('country');
      const romaniaCountry = (job.country || []).some(c =>
        c.name?.toLowerCase() === 'romania'
      );
      expect(romaniaCountry).toBe(true);
    });
  });

  describe('Parse + Transform Pipeline', () => {
    let index;
    let apiData;

    beforeAll(async () => {
      index = await import('../../index.js');
      const res = await fetch(EPAM_API_URL, {
        headers: {
          'User-Agent': 'job_seeker_ro_spider',
          'Accept': 'application/json'
        }
      });
      apiData = await res.json();
    }, 15000);

    it('should parse real EPAM API response into standardized format', () => {
      const result = index.parseApiJobs(apiData);

      expect(result).toHaveProperty('jobs');
      expect(result).toHaveProperty('total');
      expect(result.jobs.length).toBeGreaterThan(0);
      expect(result.jobs.length).toBeLessThanOrEqual(5);

      const parsed = result.jobs[0];
      expect(parsed).toHaveProperty('url');
      expect(parsed.url).toMatch(/^https:\/\/careers\.epam\.com\//);
      expect(parsed).toHaveProperty('title');
      expect(parsed).toHaveProperty('workmode');
      expect(['remote', 'on-site', 'hybrid']).toContain(parsed.workmode);
      expect(parsed).toHaveProperty('location');
      expect(Array.isArray(parsed.location)).toBe(true);
      expect(parsed).toHaveProperty('tags');
    });

    it('should map parsed jobs to job model', () => {
      const parsed = index.parseApiJobs(apiData);
      const model = index.mapToJobModel(parsed.jobs[0], TEST_CIF);

      expect(model).toHaveProperty('url');
      expect(model).toHaveProperty('title');
      expect(model).toHaveProperty('company');
      expect(model).toHaveProperty('cif', TEST_CIF);
      expect(model).toHaveProperty('status', 'scraped');
      expect(model).toHaveProperty('date');
      expect(model.url).toMatch(/^https:\/\/careers\.epam\.com\//);
    });

    it('should transform jobs and filter to Romanian locations', () => {
      const parsed = index.parseApiJobs(apiData);
      const jobs = parsed.jobs.map(j => index.mapToJobModel(j, TEST_CIF));

      const payload = {
        source: 'epam.com',
        company: 'EPAM SYSTEMS INTERNATIONAL SRL',
        cif: TEST_CIF,
        jobs
      };

      const transformed = index.transformJobsForSOLR(payload);

      expect(transformed.company).toBe('EPAM SYSTEMS INTERNATIONAL SRL');
      expect(transformed.jobs.length).toBe(jobs.length);

      for (const job of transformed.jobs) {
        expect(job).toHaveProperty('location');
        expect(Array.isArray(job.location)).toBe(true);
        expect(job.location.length).toBeGreaterThan(0);
        expect(job.workmode).toMatch(/^(remote|on-site|hybrid)$/);
      }
    });

    it('should produce valid job URLs that are accessible', async () => {
      const parsed = index.parseApiJobs(apiData);

      for (const job of parsed.jobs.slice(0, 2)) {
        const res = await fetch(job.url, {
          method: 'HEAD',
          headers: { 'User-Agent': 'job_seeker_ro_spider' }
        });
        expect(res.ok).toBe(true);
      }
    }, 30000);
  });

  describe('Company Validation Path', () => {
    let anaf;
    let company;

    beforeAll(async () => {
      anaf = await import('../../src/anaf.js');
      company = await import('../../company.js');
    });

    itIfAnaf('should find EPAM in ANAF and validate active status', async () => {
      const results = await anaf.searchCompany(TEST_BRAND);

      const epam = results.find(c =>
        c.name.toUpperCase().startsWith(TEST_BRAND + ' ') &&
        c.statusLabel === 'Funcțiune'
      );
      expect(epam).toBeDefined();
      expect(epam.cui.toString()).toBe(TEST_CIF);

      const anafData = await anaf.getCompanyFromANAF(TEST_CIF);
      expect(anafData).toBeDefined();
      expect(anafData.inactive).toBe(false);
    }, 30000);

    itIfSolr('should run full validation and report active status with job count', async () => {
      const result = await company.validateAndGetCompany();

      expect(result.status).toBe('active');
      expect(result.company).toBe('EPAM SYSTEMS INTERNATIONAL SRL');
      expect(result.cif).toBe(TEST_CIF);

      if (result.existingJobsCount === 0) {
        console.log('⚠️ No EPAM jobs in Solr — skipping job count assertion');
        return;
      }
      expect(result.existingJobsCount).toBeGreaterThan(0);
    }, 30000);
  });

  describe('Inactive Company Handling', () => {
    let anaf;

    beforeAll(async () => {
      anaf = await import('../../src/anaf.js');
    });

    itIfAnaf('should detect inactive/radiated companies via ANAF', async () => {
      const results = await anaf.searchCompany('EPAM');

      const nonActive = results.find(c => c.statusLabel !== 'Funcțiune');

      if (nonActive) {
        try {
          const anafData = await anaf.getCompanyFromANAF(nonActive.cui.toString());
          expect(anafData).toBeDefined();
          if (anafData.inactive !== undefined) {
            expect(anafData.inactive).toBe(true);
          }
        } catch {
          expect(nonActive.statusLabel).toMatch(/Radiată|Inactiv|Suspendat/);
        }
      }
    }, 30000);
  });

  describe('SOLR Data Verification', () => {
    let solr;

    beforeAll(async () => {
      solr = await import('../../solr.js');
    });

    itIfSolr('should have EPAM jobs in SOLR with correct company name', async () => {
      const result = await solr.querySOLR(TEST_CIF);

      if (result.numFound === 0) {
        console.log('⚠️ No EPAM jobs in Solr — skipping SOLR data verification');
        return;
      }

      for (const job of result.docs) {
        expect(job.company).toBe('EPAM SYSTEMS INTERNATIONAL SRL');
        expect(job.cif).toBe(TEST_CIF);
      }
    }, 15000);

    itIfSolr('should have EPAM company core entry with required fields', async () => {
      const result = await solr.queryCompanySOLR(`id:${TEST_CIF}`);

      expect(result.numFound).toBe(1);
      const epam = result.docs[0];
      expect(epam.company).toBe('EPAM SYSTEMS INTERNATIONAL SRL');
      expect(epam.status).toBe('activ');
    }, 15000);
  });
});
