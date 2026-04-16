import fetch from "node-fetch";
import fs from "fs";
import { querySOLR, deleteJobsByCIF } from "./solr.js";
import { getCompanyFromANAF, searchCompany, getCompanyFromANAFWithFallback } from "./demoanaf.js";

const Peviitor_API_URL = "https://api.peviitor.ro/v1/company/";

const COMPANY_BRAND = "EPAM";

export function getCompanyBrand() {
  return COMPANY_BRAND;
}

const COMPANY_MODEL_FIELDS = [
  { name: "id", required: true, type: "string" },
  { name: "company", required: true, type: "string" },
  { name: "brand", required: false, type: "string" },
  { name: "group", required: false, type: "string" },
  { name: "status", required: false, type: "string", allowed: ["activ", "suspendat", "inactiv", "radiat"] },
  { name: "location", required: false, type: "array" },
  { name: "website", required: false, type: "array" },
  { name: "career", required: false, type: "array" },
  { name: "lastScraped", required: false, type: "string" },
  { name: "scraperFile", required: false, type: "string" }
];

async function getCompanyFromPeviitor(companyName) {
  const url = `${Peviitor_API_URL}?name=${encodeURIComponent(companyName)}`;
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0" }
  });
  
  if (!res.ok) {
    throw new Error(`Peviitor API error: ${res.status}`);
  }
  
  const data = await res.json();
  return data.companies?.[0] || null;
}

function validateCompanyModel(data) {
  console.log("\n=== Company Model Validation ===\n");
  
  const errors = [];
  
  for (const field of COMPANY_MODEL_FIELDS) {
    const value = data[field.name];
    
    if (field.required && (value === undefined || value === null || value === "")) {
      errors.push(`Missing required field: ${field.name}`);
      continue;
    }
    
    if (value !== undefined && value !== null) {
      if (field.type === "string" && typeof value !== "string") {
        errors.push(`Field ${field.name} should be string, got ${typeof value}`);
      }
      if (field.type === "array" && !Array.isArray(value)) {
        errors.push(`Field ${field.name} should be array, got ${typeof value}`);
      }
      if (field.allowed && !field.allowed.includes(value)) {
        errors.push(`Field ${field.name} has invalid value "${value}". Allowed: ${field.allowed.join(", ")}`);
      }
    }
  }
  
  const allowedFields = COMPANY_MODEL_FIELDS.map(f => f.name);
  const extraFields = Object.keys(data).filter(k => !allowedFields.includes(k));
  if (extraFields.length > 0) {
    console.log(`Note: Extra fields in Peviitor (not in model): ${extraFields.join(", ")}`);
  }
  
  if (errors.length > 0) {
    console.log("ERRORS:");
    errors.forEach(e => console.log(`  - ${e}`));
    return false;
  }
  
  console.log("All required fields present and valid!");
  return true;
}

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
      reactivatedSince: anafData?.reactivatedSince || null,
      address: anafData?.address || null,
      registrationNumber: anafData?.registrationNumber || null,
      caenCode: anafData?.caenCode || null,
      vatRegistered: anafData?.vatRegistered || false,
      eFacturaRegistered: anafData?.eFacturaRegistered || false
    }
  };
  
  fs.writeFileSync("company.json", JSON.stringify(companyData, null, 2), "utf-8");
  console.log("\n✅ Saved company data to company.json");
  console.log("This file can be used to restore company details if SOLR data is lost.\n");
  
  return companyData;
}

function loadCachedCompanyData() {
  if (fs.existsSync("company.json")) {
    try {
      const data = JSON.parse(fs.readFileSync("company.json", "utf-8"));
      if (data?.anaf?.cui && data?.anaf?.name) {
        console.log("Found cached company data in company.json");
        return data;
      }
    } catch (e) {
      console.log("Warning: Could not load cached company data");
    }
  }
  return null;
}

export async function getCompanyData() {
  const cachedData = loadCachedCompanyData();
  
  if (!cachedData?.summary?.cif) {
    console.log(`Searching for company with brand: ${COMPANY_BRAND}`);
    const searchResults = await searchCompany(COMPANY_BRAND);
    
    if (!searchResults || searchResults.length === 0) {
      throw new Error(`No companies found for brand: ${COMPANY_BRAND}`);
    }
    
    const exactMatch = searchResults.find(c => 
      (c.name.toUpperCase().startsWith(COMPANY_BRAND.toUpperCase() + " ") || 
       c.name.toUpperCase().includes(" " + COMPANY_BRAND.toUpperCase() + " ")) &&
      c.statusLabel === "Funcțiune"
    );
    
    if (!exactMatch) {
      console.log("No exact match with 'Funcțiune' status, trying first active company...");
      const activeMatch = searchResults.find(c => c.statusLabel === "Funcțiune");
      if (!activeMatch) {
        throw new Error(`No active company found for brand: ${COMPANY_BRAND}`);
      }
      var selectedCIF = activeMatch.cui;
      console.log(`Selected: ${activeMatch.name} (CIF: ${selectedCIF})`);
    } else {
      var selectedCIF = exactMatch.cui;
      console.log(`Found exact match: ${exactMatch.name} (CIF: ${selectedCIF})`);
    }
    
    console.log(`Fetching company details for CIF: ${selectedCIF}`);
    const anafData = await getCompanyFromANAFWithFallback(selectedCIF, cachedData?.anaf);
    
    if (!anafData) {
      throw new Error("No data from ANAF and no cache - cannot proceed with scraping");
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
    
    const company = anafData.name.toUpperCase();
    const cif = anafData.cui.toString();
    const active = !anafData.inactive;
    
    return { company, cif, active, anafData };
  } else {
    console.log(`Using cached company data for CIF: ${cachedData.summary.cif}`);
    const anafData = cachedData.anaf;
    
    console.log(`Cached name: ${anafData.name}`);
    console.log(`Cached CUI: ${anafData.cui}`);
    console.log(`Cached status: ${anafData.inactive ? "INACTIVE" : "ACTIVE"}`);
    
    const company = anafData.name.toUpperCase();
    const cif = anafData.cui.toString();
    const active = !anafData.inactive;
    
    return { company, cif, active, anafData };
  }
}

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
  
  saveCompanyData(anafData, peviitorData);
  
  if (!active) {
    console.log("\n⚠️ Company is INACTIVE in ANAF - deleting jobs from SOLR and stopping");
    if (solrResult.numFound > 0) {
      await deleteJobsByCIF(cif);
    }
    return { status: "inactive", company, cif, existingJobsCount: solrResult.numFound };
  }
  
  console.log(`\n✅ Company validated: ${company}, CIF: ${cif}`);
  console.log("Ready to scrape jobs...\n");
  
  return { status: "active", company, cif, existingJobsCount: solrResult.numFound };
}

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith("company.js")) {
  console.log("=== Running company.js independently ===\n");
  
  const { company, cif, active } = await getCompanyData();
  console.log(`\nResult: company=${company}, cif=${cif}, active=${active}`);
  
  console.log("\n=== Peviitor Validation Test ===\n");
  
  try {
    const peviitorData = await getCompanyFromPeviitor(company);
    console.log("Peviitor Data:");
    console.log(JSON.stringify(peviitorData, null, 2));
    validateCompanyModel(peviitorData);
  } catch (e) {
    console.log("Peviitor API error:", e.message);
  }
  
  const result = await validateAndGetCompany();
  
  console.log("\nResult:", result);
}