# Instructions

## Project Purpose

This scraper extracts job listings from EPAM careers page (Romania only) and imports them to peviitor.ro.

Target: https://careers.epam.com/en/jobs/romania

## Model Schemas

The job and company models are defined in:
- `job-model.md` - Job model schema
- `company-model.md` - Company model schema

## Important

These models are **dynamic** and can change over time. They are based on the official Peviitor Core schemas which may be updated.

## How to Keep Models Updated

When working on this scraper:

1. **Check for updates** in the Peviitor Core repository:
   - Repository: https://github.com/peviitor-ro/peviitor_core
   - Main file: README.md (contains Job and Company model schemas)

2. **When to update**:
   - Before starting new development work
   - If field requirements or validations have changed
   - If new fields have been added

3. **How to update**:
   - Fetch the latest README.md from peviitor_core main branch
   - Compare with current job-model.md and company-model.md
   - Update local files if there are differences
   - Update index.js mapping logic if field requirements changed

## Technologies

- **Node.js & JavaScript** - For scraping and data extraction
- **Apache SOLR** - For data storage and indexing
- **OpenCode + Big Pickle** - For development

## Workflow Steps

1. **Check existing data in SOLR** - Query SOLR by CIF to see what EPAM jobs already exist
2. **Validate company via ANAF** - Test company data (name, CIF) matches ANAF using DemoANAF API
3. **Compare with Peviitor** - Verify company data in Peviitor matches company-model.md schema
4. **Check company status** - If ANAF status = "inactive" → DELETE existing jobs from SOLR and STOP (no scrape)
5. **Save company data to company.json** - Save all ANAF fields to company.json (backup for restore)
6. **Extract company fields for jobs** - If active, get company name and CIF from ANAF:
   - `company` = ANAF name (uppercase)
   - `cif` = ANAF CUI (e.g., "33159615")
   - **REQUIRED**: If company or CIF not available from ANAF → STOP workflow (cannot scrape)
7. **Scrape new jobs** - Extract jobs from EPAM careers page (Romania)
8. **Map to job model** - Transform scraped data to match Peviitor schema (using company name + CIF from step 6)
9. **Upsert to SOLR** - Import/update jobs in SOLR

## File Responsibilities

| File | Role |
|------|------|
| `index.js` | Main entry point - runs company.js first to get company + CIF, then scrapes and upserts to SOLR |
| `company.js` | Validates company via ANAF + Peviitor APIs, returns company name + CIF for index.js |
| `solr.js` | Standalone validation tool - queries SOLR, validates job fields, handles inactive company case |

## API Endpoints

- **Solr**: `https://solr.peviitor.ro/solr/job` (auth: `solr:SolrRocks`)
- **Company API**: `https://api.peviitor.ro/v1/company/`