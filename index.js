import fetch from "node-fetch";
import fs from "fs";
import { fileURLToPath } from "url";
import { validateAndGetCompany } from "./company.js";
import { querySOLR, deleteJobByUrl, upsertJobs } from "./solr.js";

const COMPANY_CIF = "33159615";
const TIMEOUT = 10000;

const JOB_BASE = "https://careers.epam.com";

const ROMANIA_COUNTRY_ID = "8150000000000001155";
const PAGE_SIZE = 10;

let COMPANY_NAME = null;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

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

  Object.keys(job).forEach((k) => job[k] === undefined && delete job[k]);

  return job;
}

function transformJobsForSOLR(payload) {
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

  const citySet = new Set(romanianCities.map(c => c.toLowerCase()));

  const normalizeWorkmode = (wm) => {
    if (!wm) return undefined;
    const lower = wm.toLowerCase();
    if (lower.includes('remote')) return 'remote';
    if (lower.includes('office') || lower.includes('on-site') || lower.includes('site')) return 'on-site';
    return 'hybrid';
  };

  const transformed = {
    ...payload,
    company: payload.company?.toUpperCase(),
    jobs: payload.jobs.map(job => {
      const validLocations = (job.location || []).filter(loc => {
        const lower = loc.toLowerCase().trim();
        if (lower === 'romania' || lower === 'românia') return true;
        return citySet.has(lower);
      }).map(loc => loc.toLowerCase() === 'romania' ? 'România' : loc);

      return {
        ...job,
        location: validLocations.length > 0 ? validLocations : ['România'],
        workmode: normalizeWorkmode(job.workmode)
      };
    })
  };

  return transformed;
}

async function main() {
  const testOnlyOnePage = process.argv.includes("--test");
  
  try {
    console.log("=== Step 1: Extract existing jobs from SOLR ===");
    const existingResult = await querySOLR(COMPANY_CIF);
    console.log(`Found ${existingResult.numFound} existing jobs in SOLR`);

    if (existingResult.numFound > 0) {
      const backup = {
        extractedAt: new Date().toISOString(),
        cif: COMPANY_CIF,
        count: existingResult.numFound,
        jobs: existingResult.docs
      };
      fs.writeFileSync("jobs_existing.json", JSON.stringify(backup, null, 2), "utf-8");
      console.log("Saved jobs_existing.json\n");
    }

    console.log("=== Step 2: Validate company via ANAF ===");
    const { company, cif } = await validateAndGetCompany();
    COMPANY_NAME = company;
    const localCif = cif;
    
    const rawJobs = await scrapeAllListings(testOnlyOnePage);
    console.log(`Found ${rawJobs.length} raw jobs`);

    const jobs = rawJobs.map(job => mapToJobModel(job, localCif));

    const payload = {
      source: "epam.com",
      scrapedAt: new Date().toISOString(),
      company: COMPANY_NAME,
      cif: localCif,
      jobs
    };

    console.log("Transforming jobs for SOLR...");
    const transformedPayload = transformJobsForSOLR(payload);
    console.log(`Jobs with valid Romanian locations: ${transformedPayload.jobs.filter(j => j.location).length}`);

    fs.writeFileSync("jobs.json", JSON.stringify(transformedPayload, null, 2), "utf-8");
    console.log("Saved jobs.json");

    console.log("\n=== Step 4: Upsert jobs to SOLR ===");
    await upsertJobs(transformedPayload.jobs);

    console.log("Cleaning up temporary files...");
    fs.unlinkSync("jobs.json");
    console.log("Deleted jobs.json");

    console.log("\n=== Step 5: Verify existing jobs URLs ===");
    if (fs.existsSync("jobs_existing.json")) {
      const existing = JSON.parse(fs.readFileSync("jobs_existing.json", "utf-8"));
      const existingJobs = existing.jobs || [];
      console.log(`Checking ${existingJobs.length} URLs...`);

      const invalidUrls = [];
      for (let i = 0; i < existingJobs.length; i++) {
        const job = existingJobs[i];
        try {
          const res = await fetch(job.url, { method: "HEAD", timeout: TIMEOUT, headers: { "User-Agent": "Mozilla/5.0" } });
          console.log(`[${i+1}/${existingJobs.length}] ${res.status} - ${job.url}`);
          if (!res.ok) invalidUrls.push(job.url);
        } catch (e) {
          console.log(`[${i+1}/${existingJobs.length}] ERR - ${job.url}`);
          invalidUrls.push(job.url);
        }
      }

      if (invalidUrls.length > 0) {
        console.log(`\n⚠️ ${invalidUrls.length} invalid URLs - deleting from SOLR...`);
        for (const url of invalidUrls) {
          await deleteJobByUrl(url);
        }
        console.log(`Deleted ${invalidUrls.length} invalid jobs`);
      }

      if (invalidUrls.length === 0) {
        console.log("\n✅ All existing URLs valid - deleting jobs_existing.json");
        fs.unlinkSync("jobs_existing.json");
      } else {
        console.log("Kept jobs_existing.json for reference");
      }
    }

    console.log("\n=== DONE ===");
    console.log("Scraper completed successfully!");

  } catch (err) {
    console.error("Scraper failed:", err);
    process.exit(1);
  }
}

export { parseApiJobs, mapToJobModel, transformJobsForSOLR };

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}