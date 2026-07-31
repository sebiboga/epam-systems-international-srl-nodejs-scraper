/**
 * EPAM-Specific Job URL Validator
 *
 * Multiple validation modes:
 *   --head      HEAD requests only (fast, default)
 *   --content   GET + body scan (catches HTML soft-404s)
 *   --browser   Playwright headless Chromium (catches JS-rendered 404s)
 *
 * Action flags:
 *   --dry-run   Show invalid jobs but do not delete
 *   --delete    Delete invalid jobs from SOLR after listing
 *
 * Called by .github/workflows/automation-testing.yml on the scheduled run.
 */
import companyConfig from "../scraper/config/company.js";
import { querySOLR, deleteJobByUrl } from "../scraper/api.js";
import { validateByHead, validateByContent, validateByBrowser } from "../scraper/job-validator.js";

const CIF = companyConfig.id;
const COMPANY = companyConfig.company;

function getTimeout() {
  const idx = process.argv.indexOf("--timeout");
  if (idx !== -1 && idx + 1 < process.argv.length) {
    return parseInt(process.argv[idx + 1], 10);
  }
  return undefined;
}

function getValidator() {
  if (process.argv.includes("--browser")) return validateByBrowser;
  if (process.argv.includes("--content")) return validateByContent;
  return validateByHead;
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const doDelete = process.argv.includes("--delete");
  const timeout = getTimeout();
  const validate = getValidator();
  const mode = process.argv.includes("--browser") ? "browser" : process.argv.includes("--content") ? "content" : "head";

  console.log(`=== Validating ${COMPANY} (CIF: ${CIF}) | mode: ${mode}${timeout ? ` | timeout: ${timeout}ms` : ""} ===\n`);

  const result = await querySOLR(CIF);
  console.log(`Total jobs in SOLR: ${result.numFound}`);

  if (result.numFound === 0) {
    console.log("No jobs to validate.");
    return;
  }

  const invalid = [];
  for (const job of result.docs) {
    const opts = timeout ? { timeout } : {};
    const check = await validate(job.url, opts);
    console.log(`[${check.httpStatus}] ${check.status === "active" ? "OK" : check.status} - ${job.title}`);
    if (check.status !== "active") invalid.push(job);
  }

  if (invalid.length === 0) {
    console.log("\n✅ All jobs valid");
    return;
  }

  console.log(`\n⚠️ ${invalid.length} invalid jobs found`);
  for (const job of invalid) {
    console.log(`  ${job.title} | ${job.url}`);
  }

  if (dryRun) {
    console.log("(dry run — no deletions performed)");
    return;
  }
  if (doDelete) {
    for (const job of invalid) {
      await deleteJobByUrl(job.url);
      console.log(`Deleted: ${job.title}`);
    }
  }
}

main().catch(err => {
  console.error("Fatal:", err.message);
  process.exit(1);
});
