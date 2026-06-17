/**
 * Generic Job URL Validator (content-aware, manual use)
 *
 * PURPOSE: Deep validation of job URLs — fetches full page body and
 * searches for "no longer available" / "position filled" / "expired"
 * keywords. Slower than HEAD-only checks but catches soft-404s where
 * the URL still returns 200 but the job is gone.
 *
 * SCOPE: Generic — works with ANY CIF, single URL, or list from file.
 * Used for ad-hoc cleanup and debugging. NOT called from CI.
 *
 * For the fast CI-friendly EPAM-only HEAD check, see
 * tests/validate-epam-jobs.js.
 *
 * Usage:
 *   node validate-jobs.js <CIF>                   - Query Solr and validate all jobs for a CIF
 *   node validate-jobs.js --url <url>             - Check a single URL
 *   node validate-jobs.js --urls <url1> <url2>... - Check multiple URLs
 *   node validate-jobs.js --file <file.json>     - Check URLs from JSON file (array or {jobs:[...]})
 */

import fs from "fs";
import { validateByContent } from "./src/job-validator.js";

async function checkUrls(urls) {
  console.log(`=== Validating ${urls.length} URLs ===\n`);
  
  const results = { active: [], expired: [], error: [] };
  
  for (let i = 0; i < urls.length; i++) {
    const url = urls[i];
    const result = await validateByContent(url);
    
    if (result.status === "active") {
      results.active.push(result);
    } else if (result.status === "expired") {
      results.expired.push(result);
    } else {
      results.error.push(result);
    }
    
    const icon = result.status === "active" ? "✅" : result.status === "expired" ? "❌" : "⚠️";
    console.log(`${icon} [${i+1}/${urls.length}] ${result.status} (HTTP ${result.httpStatus}) - ${url}`);
    if (result.title) {
      console.log(`   Title: ${result.title.substring(0, 60)}...`);
    }
    if (result.error) {
      console.log(`   Error: ${result.error}`);
    }
  }
  
  console.log(`\n=== SUMMARY ===`);
  console.log(`Total: ${urls.length}`);
  console.log(`Active: ${results.active.length} ✅`);
  console.log(`Expired: ${results.expired.length} ❌`);
  console.log(`Error: ${results.error.length} ⚠️`);
  
  return results;
}

async function validateJobs(cif) {
  console.log("=== Validate Job URLs from Solr ===\n");
  
  const { querySOLR } = await import("./solr.js");
  const result = await querySOLR(cif);
  const urls = result.docs.map(doc => doc.url);
  
  console.log(`Found ${urls.length} jobs for CIF ${cif}\n`);
  
  return await checkUrls(urls);
}

async function loadUrlsFromFile(filePath) {
  const content = fs.readFileSync(filePath, "utf-8");
  const data = JSON.parse(content);
  
  if (Array.isArray(data)) {
    return data.map(item => typeof item === "string" ? item : item.url);
  }
  
  if (data.jobs) {
    return data.jobs.map(job => job.url || job);
  }
  
  if (data.urls) {
    return data.urls;
  }
  
  throw new Error("Unknown file format. Expected array of URLs or {jobs: [...]}");
}

async function deleteExpiredJobs(expiredJobs) {
  const { deleteJobByUrl } = await import("./solr.js");
  
  console.log(`\nDeleting ${expiredJobs.length} expired jobs from SOLR...`);
  
  for (const job of expiredJobs) {
    console.log(`Deleting: ${job.url}`);
    await deleteJobByUrl(job.url);
  }
  
  console.log("Done.");
}

function parseArgs() {
  const args = process.argv.slice(2);
  const mode = args[0];
  
  if (mode === "--url" && args[1]) {
    return { mode: "single", urls: [args[1]] };
  }
  
  if (mode === "--urls") {
    return { mode: "multiple", urls: args.slice(1) };
  }
  
  if (mode === "--file" && args[1]) {
    return { mode: "file", filePath: args[1] };
  }
  
  if (!mode?.startsWith("--")) {
    return { mode: "cif", cif: mode || args[0] };
  }
  
  return { mode: "help" };
}

const help = `
Job URL Validator

Usage:
  node validate-jobs.js <CIF>                    - Query Solr and validate all jobs for a company
  node validate-jobs.js --url <url>              - Check a single URL
  node validate-jobs.js --urls <url1> <url2>... - Check multiple URLs  
  node validate-jobs.js --file <file.json>       - Check URLs from JSON file

Examples:
  node validate-jobs.js 33159615                 - Validate EPAM jobs
  node validate-jobs.js --url "https://careers.epam.com/en/vacancy/123_test"
  node validate-jobs.js --urls "url1" "url2" "url3"
  node validate-jobs.js --file jobs.json
`;

async function main() {
  const { mode, urls, cif, filePath } = parseArgs();
  
  if (mode === "help") {
    console.log(help);
    process.exit(0);
  }
  
  if (mode === "single" || mode === "multiple") {
    await checkUrls(urls);
    return;
  }
  
  if (mode === "file") {
    const fileUrls = await loadUrlsFromFile(filePath);
    await checkUrls(fileUrls);
    return;
  }
  
  if (mode === "cif" && cif) {
    const results = await validateJobs(cif);
    
    if (results.expired.length > 0) {
      const shouldDelete = process.argv.includes("--delete");
      if (shouldDelete) {
        await deleteExpiredJobs(results.expired);
      } else {
        console.log("\nPass --delete to remove expired jobs from Solr");
        
        const output = {
          timestamp: new Date().toISOString(),
          cif,
          summary: {
            total: results.active.length + results.expired.length + results.error.length,
            active: results.active.length,
            expired: results.expired.length,
            error: results.error.length
          },
          expiredJobs: results.expired.map(j => ({ url: j.url, title: j.title })),
          errorJobs: results.error.map(j => ({ url: j.url, error: j.error }))
        };
        fs.writeFileSync("tmp/expired-jobs.json", JSON.stringify(output, null, 2));
        console.log("Saved tmp/expired-jobs.json");
      }
    }
    return;
  }
  
  console.log(help);
  process.exit(1);
}

if (process.argv[1]?.includes('validate-jobs')) {
  main().catch(err => {
    console.error("Error:", err.message);
    process.exit(1);
  });
}

export { checkUrls, validateJobs, loadUrlsFromFile };