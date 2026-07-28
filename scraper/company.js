/**
 * Company Module - Company Validation and Data Management
 *
 * Handles company data validation from ANAF, caches company information,
 * and validates companies against the Peviitor API.
 */

import fetch from "node-fetch";
import fs from "fs";
import { querySOLR, deleteJobsByCIF } from "./api.js";
import { getCompanyFromANAF } from "./company-data.js";
import companyConfig from "./config/company.js";

// ============================================================================
// CONFIGURATION
// ============================================================================

const Peviitor_API_URL = "https://api.peviitor.ro/v1/company/";

const COMPANY_CIF = companyConfig.id;
const COMPANY_BRAND = companyConfig.brand;
const COMPANY_LEGAL_NAME = companyConfig.company;

const CACHE_MAX_AGE_DAYS = 7;
const ROOT_CACHE_PATH = "company.json";
const TMP_CACHE_PATH = "tmp/company.json";

// ============================================================================
// PEVIITOR API
// ============================================================================

async function getCompanyFromPeviitor(companyName) {
  const url = `${Peviitor_API_URL}?name=${encodeURIComponent(companyName)}`;
  const res = await fetch(url, {
    headers: {
      origin: "https://peviitor.ro",
      referer: "https://peviitor.ro/",
      "User-Agent": "job_seeker_ro_spider"
    }
  });

  if (!res.ok) {
    throw new Error(`Peviitor API error: ${res.status}`);
  }

  const data = await res.json();
  return data.companies?.[0] || null;
}

// ============================================================================
// DATA PERSISTENCE
// ============================================================================

function saveCompanyData(anafData, peviitorData) {
  const companyData = {
    validatedAt: new Date().toISOString(),
    source: "ANAF",
    brand: COMPANY_BRAND,
    anaf: anafData,
    peviitor: peviitorData,
    summary: {
      company: anafData?.name || null,
      cif: anafData?.cui?.toString() || null,
      active: !anafData?.inactive,
      inactiveSince: anafData?.inactiveSince || null,
      address: anafData?.address || null
    }
  };

  const json = JSON.stringify(companyData, null, 2);

  fs.mkdirSync("tmp", { recursive: true });
  fs.writeFileSync(TMP_CACHE_PATH, json, "utf-8");
  console.log(`\n✅ Saved company data to ${TMP_CACHE_PATH}`);

  fs.writeFileSync(ROOT_CACHE_PATH, json, "utf-8");
  console.log(`✅ Updated root cache ${ROOT_CACHE_PATH}\n`);

  return companyData;
}

function isValidCache(data) {
  return Boolean(data?.anaf?.cui && data?.anaf?.name);
}

function isCacheFresh(data) {
  if (!data?.validatedAt) return false;
  const ageMs = Date.now() - new Date(data.validatedAt).getTime();
  const ageDays = ageMs / (1000 * 60 * 60 * 24);
  return ageDays < CACHE_MAX_AGE_DAYS;
}

function loadCachedCompanyData() {
  for (const cachePath of [TMP_CACHE_PATH, ROOT_CACHE_PATH]) {
    if (!fs.existsSync(cachePath)) continue;
    try {
      const data = JSON.parse(fs.readFileSync(cachePath, "utf-8"));
      if (!isValidCache(data)) continue;
      if (isCacheFresh(data)) {
        console.log(`Found fresh cached company data in ${cachePath}`);
        return data;
      }
      console.log(`Found stale cached company data in ${cachePath} (older than ${CACHE_MAX_AGE_DAYS} days)`);
      return { ...data, _stale: true };
    } catch (e) {
      console.log(`Warning: Could not parse ${cachePath}`);
    }
  }
  return null;
}

// ============================================================================
// COMPANY DATA RETRIEVAL
// ============================================================================

export async function getCompanyData() {
  const cachedData = loadCachedCompanyData();

  if (cachedData && !cachedData._stale && cachedData.summary?.cif) {
    console.log(`Using cached company data for CIF: ${cachedData.summary.cif}`);
    const anafData = cachedData.anaf;

    console.log(`Cached name: ${anafData.name}`);
    console.log(`Cached status: ${anafData.inactive ? "INACTIVE" : "ACTIVE"}`);

    return {
      company: anafData.name.toUpperCase(),
      cif: anafData.cui.toString(),
      active: !anafData.inactive,
      anafData
    };
  }

  console.log(`Fetching fresh company data from ANAF for CIF: ${COMPANY_CIF}`);
  let anafData;
  try {
    anafData = await getCompanyFromANAF(COMPANY_CIF);
  } catch (err) {
    if (cachedData?.anaf) {
      console.log(`⚠️ ANAF unreachable (${err.message}) — falling back to cached data`);
      const a = cachedData.anaf;
      return {
        company: a.name.toUpperCase(),
        cif: a.cui.toString(),
        active: !a.inactive,
        anafData: a
      };
    }
    console.log(`⚠️ ANAF unreachable (${err.message}) — no cache available, proceeding with company config`);
    return {
      company: COMPANY_LEGAL_NAME,
      cif: COMPANY_CIF,
      active: true,
      anafData: null
    };
  }

  if (!anafData) {
    throw new Error("No data from ANAF - cannot proceed with scraping");
  }
  if (!anafData.name) {
    throw new Error("ANAF returned no company name - cannot proceed with scraping");
  }

  console.log(`ANAF returned name: ${anafData.name}`);
  console.log(`ANAF status: ${anafData.inactive ? "INACTIVE" : "ACTIVE"}`);

  return {
    company: anafData.name.toUpperCase(),
    cif: anafData.cui.toString(),
    active: !anafData.inactive,
    anafData
  };
}

// ============================================================================
// COMPANY VALIDATION WORKFLOW
// ============================================================================

export async function validateAndGetCompany() {
  console.log("=== Step 1: Validate company via ANAF ===\n");

  const { company, cif, active, anafData } = await getCompanyData();

  console.log("\n=== Step 2: Check existing jobs in SOLR ===\n");
  const solrResult = await querySOLR(cif);
  console.log(`Jobs found in SOLR for CIF ${cif}: ${solrResult.numFound}`);

  console.log("\n=== Step 3: Validate via Peviitor ===\n");
  let peviitorData = null;
  try {
    peviitorData = await getCompanyFromPeviitor(COMPANY_BRAND);
    console.log("Peviitor data fetched successfully");
  } catch (e) {
    console.log("Peviitor API error:", e.message);
  }

  if (anafData) {
    saveCompanyData(anafData, peviitorData);
  }

  if (!active) {
    console.log("\n⚠️ Company is INACTIVE in ANAF - deleting jobs from SOLR and stopping");
    if (solrResult.numFound > 0) {
      await deleteJobsByCIF(cif);
    }
    return { status: "inactive", company, cif, existingJobsCount: solrResult.numFound };
  }

  const address = anafData?.address || "";

  console.log(`\n✅ Company validated: ${company}, CIF: ${cif}`);
  console.log("Ready to scrape jobs...\n");

  return { status: "active", company, cif, existingJobsCount: solrResult.numFound, address, anafData };
}
