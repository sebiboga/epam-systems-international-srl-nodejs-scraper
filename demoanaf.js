/**
 * ANAF API Integration Module
 * 
 * PURPOSE: Provides interface to Romania's ANAF (National Agency for Fiscal Administration)
 * for company validation. Used to verify company existence, activity status, and get
 * official company details like registered name, address, and CIF.
 * 
 * NOTE: Uses demoanaf.ro which is a demonstration/mock API for development.
 * Production would use the actual ANAF API endpoints.
 * 
 * API Endpoints:
 * - Search: https://demoanaf.ro/api/search?q=<brand>
 * - Company Details: https://demoanaf.ro/api/company/<cif>
 */

import fetch from "node-fetch";

// ============================================================================
// CONFIGURATION
// ============================================================================

// DemoANAF API base URL for company details
const ANAF_API_URL = "https://demoanaf.ro/api/company/";

// DemoANAF API base URL for company search
const ANAF_SEARCH_URL = "https://demoanaf.ro/api/search";

// Maximum retry attempts for API calls
const MAX_RETRIES = 3;

// Delay between retry attempts in milliseconds
const RETRY_DELAY_MS = 2000;

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Promise-based sleep function for introducing delays
 * @param {number} ms - Milliseconds to sleep
 * @returns {Promise<void>}
 */
async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ============================================================================
// ANAF API - Fetching company details by CIF
// ============================================================================

/**
 * Fetches company details from ANAF API by CIF (company identifier)
 * Implements retry logic for resilience against temporary failures
 * 
 * @param {string} cif - Company CIF/CUI (8-digit number)
 * @returns {Promise<Object|null>} - Company data or null if not found
 * @throws {Error} - If API fails after all retries
 */
export async function getCompanyFromANAF(cif) {
  let lastError = null;
  
  // Retry loop with exponential backoff
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const url = `${ANAF_API_URL}${cif}`;
      const res = await fetch(url, {
        headers: { "User-Agent": "Mozilla/5.0" }
      });
      
      // Handle HTTP errors
      if (!res.ok) {
        lastError = new Error(`ANAF API error: ${res.status}`);
        console.log(`ANAF attempt ${attempt}/${MAX_RETRIES} failed: ${res.status}, retrying...`);
        if (attempt < MAX_RETRIES) await sleep(RETRY_DELAY_MS);
        continue;
      }
      
      const json = await res.json();
      
      // Handle API-level errors (e.g., company not found)
      if (json.success === false) {
        lastError = new Error(json.error?.message || "ANAF returned error");
        console.log(`ANAF attempt ${attempt}/${MAX_RETRIES} failed: ${json.error?.message}, retrying...`);
        if (attempt < MAX_RETRIES) await sleep(RETRY_DELAY_MS);
        continue;
      }
      
      // Success - return company data
      return json.data || null;
    } catch (err) {
      lastError = err;
      console.log(`ANAF attempt ${attempt}/${MAX_RETRIES} error: ${err.message}, retrying...`);
      if (attempt < MAX_RETRIES) await sleep(RETRY_DELAY_MS);
    }
  }
  
  // All retries exhausted
  throw lastError || new Error("ANAF API failed after retries");
}

// ============================================================================
// ANAF API WITH FALLBACK - Graceful degradation when API is unavailable
// ============================================================================

/**
 * Fetches company from ANAF with fallback to cached data
 * This ensures the scraper can continue when ANAF API is down
 * 
 * @param {string} cif - Company CIF/CUI
 * @param {Object|null} cachedData - Previously cached company data (from company.json)
 * @returns {Promise<Object>} - Company data (fresh or cached)
 * @throws {Error} - If API fails and no cache available
 */
export async function getCompanyFromANAFWithFallback(cif, cachedData = null) {
  try {
    // Try live API first
    return await getCompanyFromANAF(cif);
  } catch (err) {
    // API failed - log warning
    console.log(`\n⚠️ ANAF API unavailable: ${err.message}`);
    
    // Use cached data if available
    if (cachedData) {
      console.log("✅ Using cached company data as fallback");
      return cachedData;
    }
    
    // No cache - rethrow error
    throw err;
  }
}

// ============================================================================
// ANAF API - Searching companies by name/brand
// ============================================================================

/**
 * Searches for companies by brand name in ANAF database
 * Returns list of matching companies with their CIF and status
 * 
 * @param {string} brandName - Company name or brand to search for
 * @returns {Promise<Array>} - Array of matching company objects
 * @throws {Error} - If search API fails
 */
export async function searchCompany(brandName) {
  const url = `${ANAF_SEARCH_URL}?q=${encodeURIComponent(brandName)}`;
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0" }
  });
  
  if (!res.ok) {
    throw new Error(`ANAF search error: ${res.status}`);
  }
  
  const json = await res.json();
  return json.data || [];
}

// ============================================================================
// STANDALONE MODE - Test/demo the ANAF module directly
// ============================================================================

/**
 * Usage:
 *   node demoanaf.js search <brand>    - Search for companies
 *   node demoanaf.js <cif>             - Get company details by CIF
 */
if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith("demoanaf.js")) {
  const args = process.argv.slice(2);
  
  if (args[0] === "search") {
    // Search mode: find companies by name
    const brand = args[1] || "EPAM";
    console.log(`=== Searching for: ${brand} ===\n`);
    
    searchCompany(brand)
      .then(results => {
        console.log(`Found ${results.length} results:\n`);
        results.forEach((c, i) => {
          console.log(`${i+1}. ${c.name} (CIF: ${c.cui}) - ${c.statusLabel || 'N/A'}`);
        });
      })
      .catch(err => {
        console.error("Error:", err.message);
        process.exit(1);
      });
  } else {
    // Lookup mode: get company details by CIF
    const cif = args[0] || "33159615";
    console.log(`=== Testing ANAF API for CIF: ${cif} ===\n`);
    
    getCompanyFromANAF(cif)
      .then(data => {
        console.log("Company data:");
        console.log(JSON.stringify(data, null, 2));
      })
      .catch(err => {
        console.error("Error:", err.message);
        process.exit(1);
      });
  }
}
