import fetch from 'node-fetch';

const REPO = process.env.GITHUB_REPOSITORY;
const TOKEN = process.env.GITHUB_TOKEN;

const REQUIRED_TOPICS = ['job-seeker-ro-spider', 'peviitor-ro'];

describe('Repository Topics', () => {
  it('must have EXACTLY the 2 required topics', async () => {
    if (!REPO) {
      console.log('GITHUB_REPOSITORY not set — running locally, skipping API check');
      return;
    }

    const headers = { Accept: 'application/vnd.github.mercy-preview+json', 'User-Agent': 'jest-test' };
    if (TOKEN) headers.Authorization = `token ${TOKEN}`;

    const res = await fetch(`https://api.github.com/repos/${REPO}/topics`, { headers });
    expect(res.ok).toBe(true);

    const data = await res.json();
    const topics = (data.names || []).map(t => t.toLowerCase()).sort();

    console.log(`Topics: [${topics.join(', ')}]`);

    expect(topics).toHaveLength(2);
    expect(topics).toEqual(REQUIRED_TOPICS);
  });
});
