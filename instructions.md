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
8. **Transform for SOLR** - Validate and fix job data:
   - location: Only Romanian cities allowed (Bucharest, Cluj-Napoca, etc.)
   - For non-Romanian locations → default to "România"
   - tags: lowercase, no diacritics
   - company: uppercase
9. **Save jobs.json** - Save transformed jobs locally
10. **Upsert to SOLR** - Import/update jobs in SOLR (future step)

## Running the Scraper

```bash
# Set environment variables
export SOLR_AUTH=solr:SolrRocks

# Run the scraper
node index.js

# Test mode (one page only)
node index.js --test
```

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
| `index.js` | Main entry point - runs company.js first to get company + CIF, then scrapes and upserts to SOLR |
| `company.js` | Validates company via ANAF + Peviitor APIs, returns company name + CIF for index.js |
| `solr.js` | Standalone validation tool - queries SOLR, validates job fields, handles inactive company case |

## API Endpoints

- **Solr**: `https://solr.peviitor.ro/solr/job` (auth: via `SOLR_AUTH` environment variable)
- **Company API**: `https://api.peviitor.ro/v1/company/`
- **ANAF API**: `https://demoanaf.ro/api/company/`

## Environment Variables

| Variable | Description |
|----------|-------------|
| `SOLR_AUTH` | SOLR credentials in format `user:password` |

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