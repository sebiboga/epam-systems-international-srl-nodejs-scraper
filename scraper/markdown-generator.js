/**
 * Generates a markdown document with company info and current job listings.
 *
 * @param {Object} companyData - Company info (id, company, brand, status, location[], website[], career[], lastScraped)
 * @param {Array<Object>} jobs - Scraped jobs (url, title, workmode?, location?[], tags?[], status?)
 * @returns {string} Markdown content suitable for writing to docs/jobs.md
 */
export function generateJobsMarkdown(companyData, jobs) {
  const now = new Date().toISOString();
  const lines = [];

  lines.push(`# ${companyData.company}`);
  lines.push('');
  lines.push('## Company Info');
  lines.push('');
  lines.push(`| Field | Value |`);
  lines.push(`|-------|-------|`);
  lines.push(`| CIF | ${companyData.id} |`);
  if (companyData.brand)       lines.push(`| Brand | ${companyData.brand} |`);
  if (companyData.status)      lines.push(`| Status | ${companyData.status} |`);
  if (companyData.location)    lines.push(`| Location | ${companyData.location.join(', ')} |`);
  if (companyData.website)     lines.push(`| Website | ${companyData.website.map(u => `[${u}](${u})`).join(', ')} |`);
  if (companyData.career)      lines.push(`| Careers | ${companyData.career.map(u => `[${u}](${u})`).join(', ')} |`);
  if (companyData.lastScraped) lines.push(`| Last Scraped | ${companyData.lastScraped} |`);

  lines.push('');
  lines.push(`## Current Job Listings (${jobs.length})`);
  lines.push('');
  lines.push(`_Generated: ${now}_`);
  lines.push('');

  for (const job of jobs) {
    lines.push(`### ${job.title}`);
    lines.push('');
    lines.push(`- **URL:** [${job.url}](${job.url})`);
    if (job.workmode)         lines.push(`- **Work Mode:** ${job.workmode}`);
    if (job.location?.length) lines.push(`- **Location:** ${job.location.join(', ')}`);
    if (job.tags?.length)     lines.push(`- **Tags:** ${job.tags.join(', ')}`);
    if (job.status)           lines.push(`- **Status:** ${job.status}`);
    lines.push('');
  }

  return lines.join('\n');
}
