#!/usr/bin/env node

/**
 * CLI entry point for the ANAF API module
 * 
 * Usage:
 *   node demoanaf.js search <brand>    - Search for companies
 *   node demoanaf.js <cif>             - Get company details by CIF
 * 
 * The core library is in src/anaf.js — this file only provides
 * the standalone CLI interface.
 */

import { getCompanyFromANAF, searchCompany } from "./src/anaf.js";

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
