/**
 * EPAM Job Scraper - Main Entry Point
 * 
 * PURPOSE: Scrapes job listings from EPAM Careers Romania API and stores them in Solr.
 * This is the primary orchestrator that coordinates company validation, job scraping,
 * data transformation, and Solr storage.
 */

import fetch from "node-fetch";
import fs from "fs";
import { fileURLToPath } from "url";
import { validateAndGetCompany } from "./company.js";
import { querySOLR, deleteJobByUrl, upsertJobs } from "./solr.js";

// ============================================================================
// CONFIGURATION CONSTANTS
// ============================================================================

// EPAM's unique identifier in Romanian business registry (CIF/CUI)
const COMPANY_CIF = "33159615";

// Request timeout in milliseconds (10 seconds)
const TIMEOUT = 10000;

// Base URL for EPAM job listings
const JOB_BASE = "https://careers.epam.com";

// Romania's country ID in EPAM's job API system
const ROMANIA_COUNTRY_ID = "8150000000000001155";

// Number of jobs to fetch per API page request
const PAGE_SIZE = 10;

// Global variable to store company name after validation
let COMPANY_NAME = null;

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Promise-based sleep function to introduce delays between requests
 * @param {number} ms - Milliseconds to sleep
 */
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ============================================================================
// API FUNCTIONS - Fetching data from EPAM Careers
// ============================================================================

/**
 * Fetches a single page of jobs from EPAM Careers API
 * @param {number} pageNum - Page number (1-indexed)
 * @returns {Promise<Object>} - API response with job data
 */
async function fetchJobsPage(pageNum) {
  // Calculate offset for pagination (API uses 0-based indexing)
  const from = (pageNum - 1) * PAGE_SIZE;
  
  // Build EPAM API URL with filters for Romania jobs only
  const url = `https://careers.epam.com/api/jobs/v2/search/careers-i18n?from=${from}&lang=en&size=${PAGE_SIZE}&sortBy=relevance%3Brelocation%3Dasc&websiteLocale=en-us&facets=country%3D${ROMANIA_COUNTRY_ID}`;
  
  const res = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36",
      "Accept": "application/json"
    }
  });
  
  if (!res.ok) {
    throw new Error(`API error ${res.status} for page=${pageNum}`);
  }
  
  const data = await res.json();
  return data;
}

// ============================================================================
// DATA PARSING - Converting API response to our job model
// ============================================================================

/**
 * Parses raw API response into our standardized job format
 * @param {Object} apiData - Raw response from EPAM API
 * @returns {Object} - Object containing jobs array and total count
 */
function parseApiJobs(apiData) {
  // Extract jobs array from API response (handle missing data gracefully)
  const jobs = apiData.data?.jobs || [];
  const total = apiData.data?.total || 0;
  
  return {
    jobs: jobs.map(job => {
      // Determine work mode based on vacancy type
      // Maps EPAM's vacancy_type to our standardized: remote, on-site, or hybrid
      const vacancyType = job.vacancy_type || "Hybrid";
      let workmode = "hybrid";
      if (vacancyType.toLowerCase().includes("remote")) workmode = "remote";
      else if (vacancyType.toLowerCase().includes("office")) workmode = "on-site";
      
      // Extract location - prefer city names, fallback to country
      const location = [];
      if (job.city && job.city.length > 0) {
        for (const c of job.city) {
          if (c.name) location.push(c.name);
        }
      } else if (job.country?.[0]?.name) {
        location.push(job.country[0].name);
      }
      
      // Build job URL - use SEO URL if available, otherwise construct from UID
      const uid = job.uid || "";
      const seoUrl = job.seo?.url || `/en/vacancy/${uid}_en`;
      const url = seoUrl.startsWith('http') ? seoUrl : `${JOB_BASE}${seoUrl}`;
      
      // Normalize skill tags to lowercase for consistency
      const tags = (job.skills || []).map(s => s.toLowerCase());
      
      // Return standardized job object
      return {
        url,
        title: job.name,
        uid: job.uid,
        workmode,
        location,
        tags
      };
    }),
    total
  };
}

// ============================================================================
// SCRAPING LOGIC - Paginated collection of all jobs
// ============================================================================

/**
 * Scrapes all job listings from EPAM by iterating through paginated API responses
 * @param {boolean} testOnlyOnePage - If true, stops after first page (for testing)
 * @returns {Promise<Array>} - Array of unique job objects
 */
async function scrapeAllListings(testOnlyOnePage = false) {
  const allJobs = [];
  const seenUrls = new Set(); // Track seen URLs to avoid duplicates
  let page = 1;
  let totalJobs = 0;
  const MAX_PAGES = 10; // Safety limit to prevent infinite loops

  // Paginate through all job listings
  while (true) {
    console.log(`Fetching API page: ${page}`);
    const data = await fetchJobsPage(page);
    const result = parseApiJobs(data);
    const jobs = result.jobs;

    // Stop if no jobs found on this page
    if (!jobs.length) {
      console.log(`No jobs found on page ${page}, stopping.`);
      break;
    }

    // Capture total count from first page response
    if (page === 1) {
      totalJobs = result.total;
      console.log(`Total jobs on site: ${totalJobs}`);
    }

    // Collect unique jobs (avoid duplicates across pages)
    let newJobs = 0;
    for (const job of jobs) {
      if (!seenUrls.has(job.url)) {
        seenUrls.add(job.url);
        allJobs.push(job);
        newJobs++;
      }
    }
    console.log(`Page ${page}: ${jobs.length} jobs, ${newJobs} new (total: ${allJobs.length})`);

    // Test mode: stop after first page
    if (testOnlyOnePage) {
      console.log("Test mode: stopping after page 1.");
      break;
    }

    // Safety: stop after max pages
    if (page >= MAX_PAGES) {
      console.log(`Max pages (${MAX_PAGES}) reached, stopping.`);
      break;
    }

    // Stop if no new jobs (we've seen everything)
    if (newJobs === 0) {
      console.log(`No new jobs on page ${page}, stopping.`);
      break;
    }

    page += 1;
    await sleep(1000); // Respectful delay between pages
  }

  console.log(`Total unique jobs collected: ${allJobs.length}`);
  return allJobs;
}

// ============================================================================
// DATA TRANSFORMATION - Preparing jobs for Solr storage
// ============================================================================

/**
 * Maps raw job data to Solr-compatible job model with timestamps and status
 * @param {Object} rawJob - Job object from scraper
 * @param {string} cif - Company identifier
 * @param {string} companyName - Company name
 * @returns {Object} - Job object ready for Solr storage
 */
function mapToJobModel(rawJob, cif, companyName = COMPANY_NAME) {
  const now = new Date().toISOString();

  const job = {
    url: rawJob.url,
    title: rawJob.title,
    company: companyName,
    cif: cif,
    location: rawJob.location?.length ? rawJob.location : undefined,
    tags: rawJob.tags?.length ? rawJob.tags : undefined,
    workmode: rawJob.workmode || undefined,
    date: now,
    status: "scraped"
  };

  // Remove undefined fields to keep payload clean
  Object.keys(job).forEach((k) => job[k] === undefined && delete job[k]);

  return job;
}

/**
 * Transforms jobs to match Solr schema and filters for Romanian locations
 * - Ensures company name is uppercase
 * - Filters locations to only Romanian cities
 * - Normalizes work mode values
 * @param {Object} payload - Job payload with jobs array
 * @returns {Object} - Transformed payload ready for Solr
 */
function transformJobsForSOLR(payload) {
  // List of Romanian cities for location validation
  // Includes both Romanian and English spellings with diacritics
  const romanianCities = [
    'Bucharest', 'București', 'Cluj-Napoca', 'Cluj Napoca',
    'Timișoara', 'Timisoara', 'Iași', 'Iasi', 'Brașov', 'Brasov',
    'Constanța', 'Constanta', 'Craiova', 'Bacău', 'Sibiu',
    'Târgu Mureș', 'Targu Mures', 'Oradea', 'Baia Mare', 'Satu Mare',
    'Ploiești', 'Ploiesti', 'Pitești', 'Pitesti', 'Arad', 'Galați', 'Galati',
    'Brăila', 'Braila', 'Drobeta-Turnu Severin', 'Râmnicu Vâlcea', 'Ramnicu Valcea',
    'Buzău', 'Buzau', 'Botoșani', 'Botosani', 'Zalău', 'Zalau', 'Hunedoara', 'Deva',
    'Suceava', 'Bistrița', 'Bistrita', 'Tulcea', 'Călărași', 'Calarasi',
    'Giurgiu', 'Alba Iulia', 'Slatina', 'Piatra Neamț', 'Piatra Neamt', 'Roman',
    'Dumbrăvița', 'Dumbravita', 'Voluntari', 'Popești-Leordeni', 'Popesti-Leordeni',
    'Chitila', 'Mogoșoaia', 'Mogosoaia', 'Otopeni'
  ];

  // Create lookup set for O(1) city validation
  const citySet = new Set(romanianCities.map(c => c.toLowerCase()));

  /**
   * Normalizes work mode strings to standard values
   * @param {string} wm - Raw work mode string
   * @returns {string|undefined} - Normalized work mode
   */
  const normalizeWorkmode = (wm) => {
    if (!wm) return undefined;
    const lower = wm.toLowerCase();
    if (lower.includes('remote')) return 'remote';
    if (lower.includes('office') || lower.includes('on-site') || lower.includes('site')) return 'on-site';
    return 'hybrid';
  };

  // Transform the payload
  const transformed = {
    ...payload,
    company: payload.company?.toUpperCase(), // Solr convention: uppercase company names
    jobs: payload.jobs.map(job => {
      // Filter locations to only include valid Romanian cities
      // Also accept generic "Romania" or "România" as valid
      const validLocations = (job.location || []).filter(loc => {
        const lower = loc.toLowerCase().trim();
        if (lower === 'romania' || lower === 'românia') return true;
        return citySet.has(lower);
      }).map(loc => loc.toLowerCase() === 'romania' ? 'România' : loc);

      return {
        ...job,
        location: validLocations.length > 0 ? validLocations : ['România'], // Default to Romania if no city match
        workmode: normalizeWorkmode(job.workmode)
      };
    })
  };

  return transformed;
}

// ============================================================================
// MAIN ORCHESTRATION - Coordinates the entire scraping workflow
// ============================================================================

/**
 * Main function that orchestrates the complete scraping workflow:
 * 1. Check existing jobs in Solr
 * 2. Validate company via ANAF
 * 3. Scrape jobs from EPAM API
 * 4. Transform data for Solr
 * 5. Upsert jobs to Solr
 * 6. Report summary
 */
async function main() {
  // Check for --test flag to run in test mode (single page only)
  const testOnlyOnePage = process.argv.includes("--test");
  
  try {
    // Step 1: Get count of existing jobs in Solr for comparison
    console.log("=== Step 1: Get existing jobs count ===");
    const existingResult = await querySOLR(COMPANY_CIF);
    const existingCount = existingResult.numFound;
    console.log(`Found ${existingCount} existing jobs in SOLR`);
    console.log("(Keeping existing jobs - will upsert EPAM Careers jobs only)");

    // Step 2: Validate company data via ANAF (ensures we have correct company info)
    console.log("=== Step 2: Validate company via ANAF ===");
    const { company, cif } = await validateAndGetCompany();
    COMPANY_NAME = company;
    const localCif = cif;
    
    // Step 3: Scrape all jobs from EPAM Careers API
    const rawJobs = await scrapeAllListings(testOnlyOnePage);
    const scrapedCount = rawJobs.length;
    console.log(`📊 Jobs scraped from EPAM Careers website: ${scrapedCount}`);

    // Step 4: Map raw jobs to Solr model with CIF and company name
    const jobs = rawJobs.map(job => mapToJobModel(job, localCif));

    // Create payload with metadata
    const payload = {
      source: "epam.com",
      scrapedAt: new Date().toISOString(),
      company: COMPANY_NAME,
      cif: localCif,
      jobs
    };

    // Step 5: Transform jobs (filter locations, normalize values)
    console.log("Transforming jobs for SOLR...");
    const transformedPayload = transformJobsForSOLR(payload);
    const validCount = transformedPayload.jobs.filter(j => j.location).length;
    console.log(`📊 Jobs with valid Romanian locations: ${validCount}`);

    // Save transformed jobs to file (for debugging/backup)
    fs.writeFileSync("jobs.json", JSON.stringify(transformedPayload, null, 2), "utf-8");
    console.log("Saved jobs.json");

    // Step 6: Upsert all jobs to Solr (add/update)
    console.log("\n=== Step 4: Upsert jobs to SOLR ===");
    await upsertJobs(transformedPayload.jobs);

    // Step 7: Verify final count in Solr
    const finalResult = await querySOLR(COMPANY_CIF);
    console.log(`\n📊 === SUMMARY ===`);
    console.log(`📊 Jobs existing in SOLR before scrape: ${existingCount}`);
    console.log(`📊 Jobs scraped from EPAM website: ${scrapedCount}`);
    console.log(`📊 Jobs in SOLR after scrape: ${finalResult.numFound}`);
    console.log(`====================`);

    console.log("\n=== DONE ===");
    console.log("Scraper completed successfully!");

  } catch (err) {
    console.error("Scraper failed:", err);
    process.exit(1);
  }
}

// Export functions for testing
export { parseApiJobs, mapToJobModel, transformJobsForSOLR };

// Run main function when executed directly
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}
