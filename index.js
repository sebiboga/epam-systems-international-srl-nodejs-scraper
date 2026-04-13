import fetch from "node-fetch";

const JOB_BASE = "https://careers.epam.com";

const COMPANY_CIF = "33159615";
const ANAF_API_URL = "https://demoanaf.ro/api/company/";

const ROMANIA_COUNTRY_ID = "8150000000000001155";
const PAGE_SIZE = 10;

let COMPANY_NAME = null;
let COMPANY_CIF_FROM_ANAF = null;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function getCompanyFromANAF(cif) {
  const url = `${ANAF_API_URL}${cif}`;
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0" }
  });
  
  if (!res.ok) {
    throw new Error(`ANAF API error: ${res.status}`);
  }
  
  const json = await res.json();
  return json.data || null;
}

async function validateAndGetCompanyData() {
  console.log("=== Step 1: Validate company via ANAF ===\n");
  
  const anafData = await getCompanyFromANAF(COMPANY_CIF);
  
  if (!anafData) {
    throw new Error("No data from ANAF - cannot proceed with scraping");
  }
  
  if (!anafData.name) {
    throw new Error("ANAF returned no company name - cannot proceed with scraping");
  }
  
  if (!anafData.cui) {
    throw new Error("ANAF returned no CUI - cannot proceed with scraping");
  }
  
  console.log(`ANAF returned name: ${anafData.name}`);
  console.log(`ANAF returned CUI: ${anafData.cui}`);
  console.log(`ANAF status: ${anafData.inactive ? "INACTIVE" : "ACTIVE"}`);
  
  if (anafData.inactive) {
    console.log("\n⚠️ Company is INACTIVE in ANAF - will delete existing jobs from SOLR and stop");
    console.log("(SOLR delete not implemented in index.js - use solr.js for that)");
    process.exit(0);
  }
  
  COMPANY_NAME = anafData.name.toUpperCase();
  COMPANY_CIF_FROM_ANAF = anafData.cui.toString();
  
  console.log(`\n✅ Company validated: ${COMPANY_NAME}, CIF: ${COMPANY_CIF_FROM_ANAF}`);
  console.log("Ready to scrape jobs...\n");
  
  return { company: COMPANY_NAME, cif: COMPANY_CIF_FROM_ANAF };
}

async function fetchJobsPage(pageNum) {
  const from = (pageNum - 1) * PAGE_SIZE;
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

function parseApiJobs(apiData) {
  const jobs = apiData.data?.jobs || [];
  const total = apiData.data?.total || 0;
  
  return {
    jobs: jobs.map(job => {
      const vacancyType = job.vacancy_type || "Hybrid";
      let workmode = "hybrid";
      if (vacancyType.toLowerCase().includes("remote")) workmode = "remote";
      else if (vacancyType.toLowerCase().includes("office")) workmode = "on-site";
      
      const location = [];
      if (job.city && job.city.length > 0) {
        for (const c of job.city) {
          if (c.name) location.push(c.name);
        }
      } else if (job.country?.[0]?.name) {
        location.push(job.country[0].name);
      }
      
      const uid = job.uid || "";
      const url = `${JOB_BASE}/en/vacancy/${uid}_en`;
      
      const tags = (job.skills || []).map(s => s.toLowerCase());
      
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

async function scrapeAllListings(testOnlyOnePage = false) {
  const allJobs = [];
  const seenUrls = new Set();
  let page = 1;
  let totalJobs = 0;
  const MAX_PAGES = 10;

  while (true) {
    console.log(`Fetching API page: ${page}`);
    const data = await fetchJobsPage(page);
    const result = parseApiJobs(data);
    const jobs = result.jobs;

    if (!jobs.length) {
      console.log(`No jobs found on page ${page}, stopping.`);
      break;
    }

    if (page === 1) {
      totalJobs = result.total;
      console.log(`Total jobs on site: ${totalJobs}`);
    }

    let newJobs = 0;
    for (const job of jobs) {
      if (!seenUrls.has(job.url)) {
        seenUrls.add(job.url);
        allJobs.push(job);
        newJobs++;
      }
    }
    console.log(`Page ${page}: ${jobs.length} jobs, ${newJobs} new (total: ${allJobs.length})`);

    if (testOnlyOnePage) {
      console.log("Test mode: stopping after page 1.");
      break;
    }

    if (page >= MAX_PAGES) {
      console.log(`Max pages (${MAX_PAGES}) reached, stopping.`);
      break;
    }

    if (newJobs === 0) {
      console.log(`No new jobs on page ${page}, stopping.`);
      break;
    }

    page += 1;
    await sleep(1000);
  }

  console.log(`Total unique jobs collected: ${allJobs.length}`);
  return allJobs;
}

function mapToJobModel(rawJob) {
  const now = new Date().toISOString();

  const job = {
    url: rawJob.url,
    title: rawJob.title,
    company: COMPANY_NAME,
    cif: COMPANY_CIF_FROM_ANAF,
    location: rawJob.location?.length ? rawJob.location : undefined,
    tags: rawJob.tags?.length ? rawJob.tags : undefined,
    workmode: rawJob.workmode || undefined,
    date: now,
    status: "scraped"
  };

  Object.keys(job).forEach((k) => job[k] === undefined && delete job[k]);

  return job;
}

async function main() {
  const testOnlyOnePage = process.argv.includes("--test");
  
  try {
    await validateAndGetCompanyData();
    
    const rawJobs = await scrapeAllListings(testOnlyOnePage);
    console.log(`Found ${rawJobs.length} raw jobs`);

    const jobs = rawJobs.map(mapToJobModel);

    const payload = {
      source: "epam.com",
      scrapedAt: new Date().toISOString(),
      company: COMPANY_NAME,
      cif: COMPANY_CIF_FROM_ANAF,
      jobs
    };

    const fs = await import("fs");
    fs.writeFileSync("jobs.json", JSON.stringify(payload, null, 2), "utf-8");
    console.log("Saved jobs.json");
  } catch (err) {
    console.error("Scraper failed:", err);
    process.exit(1);
  }
}

main();