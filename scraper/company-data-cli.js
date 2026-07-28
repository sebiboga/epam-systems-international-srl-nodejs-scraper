#!/usr/bin/env node

/**
 * CLI entry point for the company data module
 * 
 * Usage:
 *   node company-data-cli.js search <brand>    - Search for companies
 *   node company-data-cli.js <cif>             - Get company details by CIF
 * 
 * The core library is in company-data.js — this file only provides
 * the standalone CLI interface.
 */

import { getCompanyFromANAF, searchCompany } from "./company-data.js";
import companyConfig from "./config/company.js";

const args = process.argv.slice(2);

if (args[0] === "search") {
  const brand = args[1] || companyConfig.brand;
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
  const cif = args[0] || companyConfig.id;
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
