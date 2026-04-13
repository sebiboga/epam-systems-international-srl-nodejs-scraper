import fetch from "node-fetch";
import fs from "fs";
import { querySOLR, deleteJobsByCIF } from "./solr.js";

const Peviitor_API_URL = "https://api.peviitor.ro/v1/company/";
const ANAF_API_URL = "https://demoanaf.ro/api/company/";

const COMPANY_CIF = "33159615";

export function getCompanyCIF() {
  return COMPANY_CIF;
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

export async function getCompanyData() {
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
  
  const company = anafData.name.toUpperCase();
  const cif = anafData.cui.toString();
  const active = !anafData.inactive;
  
  return { company, cif, active, anafData };
}

export async function validateAndGetCompany() {
  console.log("=== Step 1: Validate company via ANAF ===\n");
  
  const { company, cif, active, anafData } = await getCompanyData();
  
  console.log("\n=== Step 2: Check existing jobs in SOLR ===\n");
  const solrResult = await querySOLR(cif);
  console.log(`Jobs found in SOLR for CIF ${cif}: ${solrResult.numFound}`);
  
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
  
  const anafData = await getCompanyFromANAF(COMPANY_CIF);
  console.log("ANAF Data:");
  console.log(JSON.stringify(anafData, null, 2));
  
  console.log("\n=== Peviitor Validation Test ===\n");
  
  try {
    const peviitorData = await getCompanyFromPeviitor("EPAM");
    console.log("Peviitor Data:");
    console.log(JSON.stringify(peviitorData, null, 2));
    validateCompanyModel(peviitorData);
  } catch (e) {
    console.log("Peviitor API error:", e.message);
  }
  
  const result = await validateAndGetCompany();
  saveCompanyData(anafData, null);
  
  console.log("\nResult:", result);
}