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

1. **Start with brand** - We know the brand (e.g., "EPAM")
2. **Search in DemoANAF** - Find company by brand, get CIF from search results
3. **Get company details from ANAF** - Using CIF, fetch full company data from ANAF
4. **Validate with Peviitor** - Verify company exists in Peviitor, get group/brand info
5. **Check existing jobs in SOLR** - Query SOLR by CIF to see what jobs already exist
6. **Check company status** - If ANAF status = "inactive" → DELETE existing jobs from SOLR and STOP
7. **Save company.json** - Save all ANAF + Peviitor data for backup
8. **Scrape new jobs** - Extract jobs from EPAM careers page (Romania)
9. **Transform for SOLR** - Validate and fix job data:
   - location: Only Romanian cities allowed
   - tags: lowercase, no diacritics
   - company: uppercase
10. **Upsert to SOLR** - Import/update jobs in SOLR
11. **Verify URLs** - Check existing job URLs still work, delete 404s

## Running the Scraper

```bash
# Set environment variables
export SOLR_AUTH=solr:SolrRocks

# Run the full scraper workflow (single command)
node index.js

# Test mode (one page only)
node index.js --test
```

## Full Workflow (automatic)

When running `node index.js`, the following steps happen automatically:

1. **Extract existing jobs from SOLR** - Backup current jobs to `jobs_existing.json`
2. **Validate company via ANAF** - Check company exists and is active
3. **Scrape jobs** - Extract jobs from EPAM careers API
4. **Transform for SOLR** - Fix locations (only Romanian cities), normalize fields
5. **Upsert to SOLR** - Add new jobs to SOLR
6. **Cleanup** - Delete temporary `jobs.json`
7. **Verify existing URLs** - Check all old job URLs still work
8. **Delete invalid jobs** - Remove 404 jobs from SOLR
9. **Cleanup backup** - Delete `jobs_existing.json` if all URLs valid

## Workflow Flowchart

```
index.js
    │
    ▼
company.js (validate company)
    ├── ANAF API ──► get company name + CIF
    ├── Peviitor API ──► validate company model
    └── SOLR ──► check existing jobs
    │
    ▼ (if active)
scrape EPAM API (jobs for Romania)
    │
    ▼
transformJobsForSOLR()
    ├── Filter: keep only Romanian locations
    ├── Fallback: "România" for unknown locations
    └── Format: lowercase tags, uppercase company
    │
    ▼
jobs.json (ready for SOLR upsert)
```

## File Responsibilities

| File | Role |
|------|------|
| `index.js` | Main entry point - full workflow: extract existing → validate company → scrape → transform → upsert → verify |
| `company.js` | Validates company via ANAF + Peviitor, checks if company is active/inactive, saves company.json |
| `solr.js` | SOLR operations module - query, delete, upsert jobs + standalone commands |
| `demoanaf.js` | ANAF API module - searchCompany(brand) and getCompanyFromANAF(cif) |

## API Endpoints

- **DemoANAF Search**: `https://demoanaf.ro/api/search?q=BRAND` - Search companies by name/brand
- **DemoANAF Company**: `https://demoanaf.ro/api/company/:cui` - Get company details by CIF
- **Peviitor API**: `https://api.peviitor.ro/v1/company/`
- **Solr**: `https://solr.peviitor.ro/solr/job` (auth: via `SOLR_AUTH` environment variable)

## Environment Variables

| Variable | Description |
|----------|-------------|
| `SOLR_AUTH` | SOLR credentials in format `user:password` |

## Standalone Commands

```bash
# Verify jobs in SOLR by CIF
node solr.js <CIF>

# Extract existing jobs from SOLR by CIF
node solr.js extract <CIF>

# Query company in SOLR
node solr.js company <search_term>

# Get company details from ANAF by CIF
node demoanaf.js <CIF>

# Search companies in ANAF by brand
node demoanaf.js search <brand>
```

## Testing

This project requires multiple levels of testing:

1. **Unit Tests** - Test individual modules (solr.js, company.js) in isolation
2. **Integration Tests** - Test API interactions (ANAF, Peviitor, SOLR) in `/tests/integration` folder
3. **E2E Tests** - Test full workflow in `/tests/e2e` folder

Run tests:
```bash
npm test
```

## Technical Debt / Future Work

- [ ] Extract demoanaf.js to separate module
- [ ] Write Unit Tests for all modules
- [ ] Write Integration Tests in separate folder
- [ ] Write E2E automated tests in separate folder
- [ ] Write Unit/Component/E2E tests for index.js