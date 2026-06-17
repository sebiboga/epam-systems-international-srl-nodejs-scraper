import { jest } from '@jest/globals';

const mockFetch = jest.fn();

jest.unstable_mockModule('node-fetch', () => ({
  default: mockFetch
}));

describe('src/job-validator.js', () => {
  let validator;

  beforeAll(async () => {
    validator = await import('../../src/job-validator.js');
  });

  beforeEach(() => {
    mockFetch.mockReset();
  });

  describe('validateByHead', () => {
    it('returns active when HEAD response is ok', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true, status: 200 });
      const result = await validator.validateByHead('https://example.com/job/1');
      expect(result.status).toBe('active');
      expect(result.httpStatus).toBe(200);
      expect(result.error).toBeNull();
    });

    it('returns expired on non-2xx response', async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 404 });
      const result = await validator.validateByHead('https://example.com/job/2');
      expect(result.status).toBe('expired');
      expect(result.httpStatus).toBe(404);
    });

    it('returns error when fetch throws', async () => {
      mockFetch.mockRejectedValueOnce(new Error('network down'));
      const result = await validator.validateByHead('https://example.com/job/3');
      expect(result.status).toBe('error');
      expect(result.error).toBe('network down');
    });

    it('issues a HEAD request', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true, status: 200 });
      await validator.validateByHead('https://example.com/job/4');
      expect(mockFetch).toHaveBeenCalledWith(
        'https://example.com/job/4',
        expect.objectContaining({ method: 'HEAD' })
      );
    });
  });

  describe('validateByContent', () => {
    it('returns active when body has no expired keywords', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => '<html><title>Software Engineer</title>Apply now</html>'
      });
      const result = await validator.validateByContent('https://example.com/job/1');
      expect(result.status).toBe('active');
      expect(result.title).toBe('Software Engineer');
    });

    it('returns expired when body has an expired keyword', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => '<html><title>Old Job</title>Sorry, this position is no longer available.</html>'
      });
      const result = await validator.validateByContent('https://example.com/job/2');
      expect(result.status).toBe('expired');
      expect(result.title).toBe('Old Job');
    });

    it('accepts custom keywords', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => '<html>Vacancy closed</html>'
      });
      const result = await validator.validateByContent('https://example.com/job/3', {
        keywords: ['vacancy closed']
      });
      expect(result.status).toBe('expired');
    });

    it('returns error when fetch throws', async () => {
      mockFetch.mockRejectedValueOnce(new Error('timeout'));
      const result = await validator.validateByContent('https://example.com/job/4');
      expect(result.status).toBe('error');
      expect(result.error).toBe('timeout');
    });
  });

  describe('DEFAULT_EXPIRED_KEYWORDS', () => {
    it('is a non-empty array of lowercase strings', () => {
      expect(Array.isArray(validator.DEFAULT_EXPIRED_KEYWORDS)).toBe(true);
      expect(validator.DEFAULT_EXPIRED_KEYWORDS.length).toBeGreaterThan(0);
      for (const kw of validator.DEFAULT_EXPIRED_KEYWORDS) {
        expect(kw).toBe(kw.toLowerCase());
      }
    });
  });
});
