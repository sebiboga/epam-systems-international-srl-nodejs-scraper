/**
 * Company Module - Company Validation and Data Management
 * 
 * PURPOSE: Handles company data validation from ANAF, caches company information,
 * and validates companies against the Peviitor API. This module ensures the scraper
 * only processes legitimate, active companies registered in Romania.
 */

import fetch from "node-fetch";
import fs from "fs";
import { querySOLR, deleteJobsByCIF } from "./solr.js";
import { getCompanyFromANAF, searchCompany, getCompanyFromANAFWithFallback } from "./demoanaf.js";

// ============================================================================
// CONFIGURATION
// ============================================================================

// Peviitor API base URL for company validation
const Peviitor_API_URL = "https://api.peviitor.ro/v1/company/";

// Company brand name (used for searching in ANAF)
const COMPANY_BRAND = "EPAM";

/**
 * Returns the company brand name
 * @returns {string} - The brand name
 */
export function getCompanyBrand() {
  return COMPANY_BRAND;
}

// ============================================================================
// COMPANY MODEL - Defines the expected schema for company data
// ============================================================================

/**
 * Company model field definitions for validation
 * Used to ensure data integrity and compliance with Peviitor schema
 */
const COMPANY_MODEL_FIELDS = [
  { name: "id", required: true, type: "string" },           // CIF/CUI as string
  { name: "company", required: true, type: "string" },      // Official company name
  { name: "brand", required: false, type: "string" },        // Marketing brand name
  { name: "group", required: false, type: "string" },        // Corporate group
  { name: "status", required: false, type: "string", allowed: ["activ", "suspendat", "inactiv", "radiat"] }, // Romanian business status
  { name: "location", required: false, type: "array" },     // Office locations
  { name: "website", required: false, type: "array" },       // Company website URLs
  { name: "career", required: false, type: "array" },       // Career page URLs
  { name: "lastScraped", required: false, type: "string" },  // Last scrape timestamp
  { name: "scraperFile", required: false, type: "string" }   // Link to scraper source
];

// ============================================================================
// PEVIITOR API - External validation
// ============================================================================

/**
 * Fetches company data from Peviitor API
 * Used for cross-validation with Peviitor's existing company database
 * @param {string} companyName - Name to search for
 * @returns {Promise<Object|null>} - Company data or null if not found
 */
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

// ============================================================================
// DATA VALIDATION
// ============================================================================

/**
 * Validates company data against the COMPANY_MODEL schema
 * Checks for required fields, correct types, and allowed values
 * @param {Object} data - Company data to validate
 * @returns {boolean} - True if valid, false otherwise
 */
function validateCompanyModel(data) {
  console.log("\n=== Company Model Validation ===\n");
  
  const errors = [];
  
  // Check each field in the model
  for (const field of COMPANY_MODEL_FIELDS) {
    const value = data[field.name];
    
    // Check required fields
    if (field.required && (value === undefined || value === null || value === "")) {
      errors.push(`Missing required field: ${field.name}`);
      continue;
    }
    
    // Validate field types
    if (value !== undefined && value !== null) {
      if (field.type === "string" && typeof value !== "string") {
        errors.push(`Field ${field.name} should be string, got ${typeof value}`);
      }
      if (field.type === "array" && !Array.isArray(value)) {
        errors.push(`Field ${field.name} should be array, got ${typeof value}`);
      }
      // Validate allowed values for enum fields
      if (field.allowed && !field.allowed.includes(value)) {
        errors.push(`Field ${field.name} has invalid value "${value}". Allowed: ${field.allowed.join(", ")}`);
      }
    }
  }
  
  // Warn about extra fields not in the model
  const allowedFields = COMPANY_MODEL_FIELDS.map(f => f.name);
  const extraFields = Object.keys(data).filter(k => !allowedFields.includes(k));
  if (extraFields.length > 0) {
    console.log(`Note: Extra fields in Peviitor (not in model): ${extraFields.join(", ")}`);
  }
  
  // Report results
  if (errors.length > 0) {
    console.log("ERRORS:");
    errors.forEach(e => console.log(`  - ${e}`));
    return false;
  }
  
  console.log("All required fields present and valid!");
  return true;
}

// ============================================================================
// DATA PERSISTENCE - Caching company data
// ============================================================================

/**
 * Saves company data to company.json for caching
 * This allows the scraper to work offline when ANAF API is unavailable
 * @param {Object} anafData - Company data from ANAF
 * @param {Object} peviitorData - Company data from Peviitor (optional)
 * @returns {Object} - The saved company data object
 */
function saveCompanyData(anafData, peviitorData) {
  const companyData = {
    // Metadata
    validatedAt: new Date().toISOString(),
    source: "ANAF",
    brand: COMPANY_BRAND,
    
    // Raw data from sources
    anaf: anafData,
    peviitor: peviitorData,
    
    // Summary with extracted key fields
    summary: {
      company: anafData?.name || null,                    // Official company name
      cif: anafData?.cui?.toString() || null,              // CIF as string
      active: !anafData?.inactive,                          // Active status
      inactiveSince: anafData?.inactiveSince || null,       // When became inactive
      reactivatedSince: anafData?.reactivatedSince || null,  // When reactivated
      address: anafData?.address || null,                   // Registered address
      registrationNumber: anafData?.registrationNumber || null, // J40/... number
      caenCode: anafData?.caenCode || null,                 // Business activity code
      vatRegistered: anafData?.vatRegistered || false,      // TVA status
      eFacturaRegistered: anafData?.eFacturaRegistered || false // e-Factura status
    }
  };
  
  // Save to file for future use
  fs.writeFileSync("company.json", JSON.stringify(companyData, null, 2), "utf-8");
  console.log("\n✅ Saved company data to company.json");
  console.log("This file can be used to restore company details if SOLR data is lost.\n");
  
  return companyData;
}

/**
 * Loads cached company data from company.json
 * Falls back to ANAF API if cache is missing or invalid
 * @returns {Object|null} - Cached company data or null
 */
function loadCachedCompanyData() {
  if (fs.existsSync("company.json")) {
    try {
      const data = JSON.parse(fs.readFileSync("company.json", "utf-8"));
      // Validate cache has required fields
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

// ============================================================================
// COMPANY DATA RETRIEVAL - Main entry point for getting company info
// ============================================================================

/**
 * Gets company data, preferring cache over live API calls
 * Searches ANAF by brand name, fetches details, and caches result
 * @returns {Promise<Object>} - Company data with company name, CIF, and active status
 */
export async function getCompanyData() {
  // Try to load from cache first
  const cachedData = loadCachedCompanyData();
  
  // If no cache, search and fetch from ANAF
  if (!cachedData?.summary?.cif) {
    console.log(`Searching for company with brand: ${COMPANY_BRAND}`);
    const searchResults = await searchCompany(COMPANY_BRAND);
    
    if (!searchResults || searchResults.length === 0) {
      throw new Error(`No companies found for brand: ${COMPANY_BRAND}`);
    }
    
    // Find exact match with "Funcțiune" (active) status
    const exactMatch = searchResults.find(c => 
      (c.name.toUpperCase().startsWith(COMPANY_BRAND.toUpperCase() + " ") || 
       c.name.toUpperCase().includes(" " + COMPANY_BRAND.toUpperCase() + " ")) &&
      c.statusLabel === "Funcțiune"
    );
    
    if (!exactMatch) {
      // Fallback: take first active company
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
    
    // Fetch detailed company info from ANAF
    console.log(`Fetching company details for CIF: ${selectedCIF}`);
    // Use fallback to cached data if ANAF fails
    const anafData = await getCompanyFromANAFWithFallback(selectedCIF, cachedData?.anaf);
    
    // Validate we got valid data
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
    
    // Return normalized data
    const company = anafData.name.toUpperCase();
    const cif = anafData.cui.toString();
    const active = !anafData.inactive;
    
    return { company, cif, active, anafData };
  } else {
    // Use cached data
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

// ============================================================================
// COMPANY VALIDATION WORKFLOW - Orchestrates validation steps
// ============================================================================

/**
 * Complete company validation workflow:
 * 1. Validate company exists in ANAF (active)
 * 2. Check existing jobs in SOLR
 * 3. Cross-validate with Peviitor API
 * 4. Cache data for offline use
 * 5. Delete SOLR jobs if company is inactive
 * 
 * @returns {Promise<Object>} - Validation result with status and job count
 */
export async function validateAndGetCompany() {
  console.log("=== Step 1: Validate company via ANAF ===\n");
  
  // Get company data from ANAF (or cache)
  const { company, cif, active, anafData } = await getCompanyData();
  
  // Check how many jobs already exist in SOLR for this company
  console.log("\n=== Step 2: Check existing jobs in SOLR ===\n");
  const solrResult = await querySOLR(cif);
  console.log(`Jobs found in SOLR for CIF ${cif}: ${solrResult.numFound}`);
  
  // Cross-validate with Peviitor
  console.log("\n=== Step 3: Validate via Peviitor ===\n");
  let peviitorData = null;
  try {
    peviitorData = await getCompanyFromPeviitor(COMPANY_BRAND);
    console.log("Peviitor data fetched successfully");
  } catch (e) {
    console.log("Peviitor API error:", e.message);
  }
  
  // Save company data to cache
  saveCompanyData(anafData, peviitorData);
  
  // If company is inactive, remove their jobs from SOLR
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

// ============================================================================
// STANDALONE MODE - Run company.js directly for testing
// ============================================================================

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
