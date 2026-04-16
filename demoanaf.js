import fetch from "node-fetch";

const ANAF_API_URL = "https://demoanaf.ro/api/company/";
const ANAF_SEARCH_URL = "https://demoanaf.ro/api/search";

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 2000;

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function getCompanyFromANAF(cif) {
  let lastError = null;
  
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const url = `${ANAF_API_URL}${cif}`;
      const res = await fetch(url, {
        headers: { "User-Agent": "Mozilla/5.0" }
      });
      
      if (!res.ok) {
        lastError = new Error(`ANAF API error: ${res.status}`);
        console.log(`ANAF attempt ${attempt}/${MAX_RETRIES} failed: ${res.status}, retrying...`);
        if (attempt < MAX_RETRIES) await sleep(RETRY_DELAY_MS);
        continue;
      }
      
      const json = await res.json();
      
      if (json.success === false) {
        lastError = new Error(json.error?.message || "ANAF returned error");
        console.log(`ANAF attempt ${attempt}/${MAX_RETRIES} failed: ${json.error?.message}, retrying...`);
        if (attempt < MAX_RETRIES) await sleep(RETRY_DELAY_MS);
        continue;
      }
      
      return json.data || null;
    } catch (err) {
      lastError = err;
      console.log(`ANAF attempt ${attempt}/${MAX_RETRIES} error: ${err.message}, retrying...`);
      if (attempt < MAX_RETRIES) await sleep(RETRY_DELAY_MS);
    }
  }
  
  throw lastError || new Error("ANAF API failed after retries");
}

export async function getCompanyFromANAFWithFallback(cif, cachedData = null) {
  try {
    return await getCompanyFromANAF(cif);
  } catch (err) {
    console.log(`\n⚠️ ANAF API unavailable: ${err.message}`);
    
    if (cachedData) {
      console.log("✅ Using cached company data as fallback");
      return cachedData;
    }
    
    throw err;
  }
}

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

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith("demoanaf.js")) {
  const args = process.argv.slice(2);
  
  if (args[0] === "search") {
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