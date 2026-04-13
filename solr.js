import fetch from "node-fetch";

const SOLR_URL = "https://solr.peviitor.ro/solr/job";
const AUTH = "solr:SolrRocks";

const COMPANY_CIF = "33159615";
const COMPANY_NAME = "EPAM SYSTEMS INTERNATIONAL SRL";
const ANAF_API_URL = "https://demoanaf.ro/api/company/";

async function getCompanyFromANAF(cif) {
  const url = `${ANAF_API_URL}${cif}`;
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0" }
  });
  
  if (!res.ok) throw new Error(`ANAF API error: ${res.status}`);
  const json = await res.json();
  return json.data || null;
}

async function querySOLR(field, value) {
  const params = new URLSearchParams({
    q: `${field}:${value}`,
    rows: 100,
    wt: "json"
  });

  const res = await fetch(`${SOLR_URL}/select?${params}`, {
    headers: {
      "Authorization": "Basic " + Buffer.from(AUTH).toString("base64"),
      "User-Agent": "Mozilla/5.0"
    }
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`SOLR query error: ${res.status} - ${text}`);
  }

  const data = await res.json();
  return data.response;
}

async function deleteJobsByCIF(cif) {
  const params = new URLSearchParams({
    commit: "true"
  });

  const deleteQuery = JSON.stringify({
    delete: { query: `cif:${cif}` }
  });

  const res = await fetch(`${SOLR_URL}/update?${params}`, {
    method: "POST",
    headers: {
      "Authorization": "Basic " + Buffer.from(AUTH).toString("base64"),
      "Content-Type": "application/json",
      "User-Agent": "Mozilla/5.0"
    },
    body: deleteQuery
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`SOLR delete error: ${res.status} - ${text}`);
  }

  console.log("✅ Jobs deleted from SOLR.");
}

async function runWorkflow() {
  console.log("=== Step 1: Check existing data in SOLR ===\n");
  
  const resultByCif = await querySOLR("cif", COMPANY_CIF);
  console.log(`Jobs found with cif:${COMPANY_CIF} => ${resultByCif.numFound} found\n`);

  console.log("--- Validate Job Fields ---");
  const allJobs = resultByCif.docs;
  let validJobs = 0;
  
  allJobs.forEach((job, i) => {
    const cifOk = job.cif === COMPANY_CIF;
    const companyOk = job.company?.toUpperCase() === COMPANY_NAME.toUpperCase();
    if (cifOk && companyOk) validJobs++;
  });

  console.log(`Valid jobs (correct CIF + company): ${validJobs}/${allJobs.length}\n`);

  console.log("=== Step 2: Validate company via ANAF ===\n");
  
  const anafData = await getCompanyFromANAF(COMPANY_CIF);
  console.log(`ANAF returned name: ${anafData?.name}`);
  console.log(`ANAF status: ${anafData?.inactive ? "INACTIVE ⚠️" : "ACTIVE ✅"}`);

  if (anafData?.inactive) {
    console.log("\n⚠️ Company is INACTIVE in ANAF!");
    console.log("=== Step 3: Company inactive - Stop workflow ===\n");
    console.log(`Deleting ${resultByCif.numFound} existing jobs from SOLR...`);
    await deleteJobsByCIF(COMPANY_CIF);
    console.log("Workflow STOPPED - company is inactive.");
    return { status: "inactive", jobsDeleted: resultByCif.numFound };
  }

  console.log("\n=== Step 3: Company is ACTIVE - Continue workflow ===\n");
  console.log(`Company name from ANAF: ${anafData?.name}`);
  console.log(`CIF from ANAF: ${anafData?.cui}`);
  console.log("Ready to scrape new jobs...");

  return { 
    status: "active", 
    companyName: anafData?.name, 
    cif: anafData?.cui,
    existingJobsCount: resultByCif.numFound 
  };
}

runWorkflow();