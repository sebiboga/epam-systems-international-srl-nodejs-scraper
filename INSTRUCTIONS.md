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
- **Claude Code** - For development

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
export SOLR_AUTH=your-solr-credentials

# Run the full scraper workflow (single command)
node index.js

# Test mode (one page only, limit 10 jobs)
node index.js --test
```

> **Important**: Scraper does NOT delete jobs from other sources (ANOFM, etc). It only upserts EPAM Careers jobs. Existing jobs are preserved.

## Full Workflow (automatic)

When running `node index.js`, the following steps happen automatically:

1. **Check existing jobs count** - Query SOLR by CIF (read-only)
2. **Validate company via ANAF** - Check company exists and is active
3. **Scrape jobs** - Extract jobs from EPAM careers API (Romania only)
4. **Transform for SOLR** - Fix locations (only Romanian cities), normalize fields
5. **Upsert to SOLR** - Add/update jobs (SOLR handles duplicates by URL)
6. **Show Summary** - Log job counts

**Important**: We do NOT delete existing jobs! This preserves jobs from other sources (ANOFM, etc).

## Workflow Flowchart

```
config/company.json (single source of truth: CIF, brand, URLs)
    │
    ▼
index.js
    │
    ▼
querySOLR(CIF) - just count, don't delete
    │
    ▼
company.js (validate company)
    ├── load cache (tmp/company.json → company.json)
    │   └── if fresh (<7 days), skip ANAF entirely
    ├── ANAF API ──► get company name + CIF (only if cache stale/missing)
    ├── Peviitor API ──► validate company model
    └── SOLR ──► check existing jobs count
    │
    ▼ (if active)
scrape EPAM API (jobs for Romania)
    │
    ▼
transformJobsForSOLR()
    ├── Filter: keep only Romanian locations
    │         (Bucharest, Cluj-Napoca, etc)
    ├── Fallback: "România" for unknown
    └── Format: lowercase tags, uppercase company
    │
    ▼
upsertJobs() - SOLR handles duplicate by URL
    │
    ▼
generateJobsMarkdown() → docs/jobs.md
    └── committed to repo by CI → available on GitHub Pages
```

## File Responsibilities

| File | Role |
|------|------|
| `config/company.json` | **Single source of truth** for company identity (CIF, brand, URLs, API params) |
| `config/company.js` | ESM wrapper that loads `config/company.json` for Node code |
| `index.js` | Main entry point - full workflow: validate company → scrape → transform → upsert → generate docs/jobs.md |
| `company.js` | Validates company via ANAF + Peviitor; caches in root `company.json` (7-day TTL) and `tmp/company.json` |
| `solr.js` | SOLR operations module - query, delete, upsert jobs + standalone commands |
| `validate-jobs.js` | Manual deep validator (content-aware); thin CLI wrapper over `src/job-validator.js` |
| `src/anaf.js` | ANAF API core module - searchCompany(brand) and getCompanyFromANAF(cif) with 3-retry/2s-backoff |
| `src/markdown-generator.js` | Generates `docs/jobs.md` with company info and all scraped jobs |
| `src/job-validator.js` | Shared validation primitives: `validateByHead`, `validateByContent`, `DEFAULT_EXPIRED_KEYWORDS` |
| `demoanaf.js` | CLI entry point for ANAF module (thin wrapper around src/anaf.js) |
| `tests/validate-epam-jobs.js` | CI fast validator (HEAD only); thin CLI over `src/job-validator.js` + `solr.js` |
| `tests/unit/index.test.js` | Unit tests for parseApiJobs, mapToJobModel, transformJobsForSOLR |
| `tests/unit/company.test.js` | Unit tests for validateAndGetCompany and fallback caching |
| `tests/unit/solr.test.js` | Unit tests for SOLR query, upsert, delete operations |
| `tests/unit/demoanaf.test.js` | Unit tests for ANAF search and company retrieval |
| `tests/integration/workflow.test.js` | Live integration tests - ANAF + SOLR |
| `tests/e2e/scraper.test.js` | End-to-end tests with real EPAM API |
| `tests/consistency/public.test.js` | Verifies repo is public on GitHub |
| `tests/consistency/repo.test.js` | Verifies branch, Pages, secrets, workflow files |
| `tests/consistency/topics.test.js` | Verifies required repo topics |
| `tests/consistency/workflow-naming.test.js` | Validates workflow naming conventions |

## API Endpoints

- **DemoANAF Search**: `https://demoanaf.ro/api/search?q=BRAND` - Search companies by name/brand
- **DemoANAF Company**: `https://demoanaf.ro/api/company/:cui` - Get company details by CIF
- **Peviitor API**: `https://api.peviitor.ro/v1/company/`
- **Solr**: `https://solr.peviitor.ro/solr/job` (auth: via `SOLR_AUTH` environment variable)

## Rate Limiting & Politeness

The scraper is intentionally slow to be a good citizen:

| Setting | Value | Where |
|---------|-------|-------|
| Delay between pages | 1000 ms | `index.js` — `sleep(1000)` in `scrapeAllListings()` |
| Page size | 10 jobs | `index.js` — `PAGE_SIZE` constant |
| Max pages | 10 | `index.js` — `MAX_PAGES` in `scrapeAllListings()` |
| Request timeout | 10000 ms | `index.js` — `TIMEOUT` constant |
| ANAF retries | 3 attempts, 2s exponential backoff | `src/anaf.js` |
| Concurrency | 1 (sequential) | No `Promise.all` for paginated fetches |
| User-Agent | `job_seeker_ro_spider` | Identifies the scraper in server logs |

Derived scrapers should keep these defaults unless the target site explicitly permits otherwise.

## Environment Variables

| Variable | Description |
|----------|-------------|
| `SOLR_AUTH` | SOLR credentials in format `user:password` |
| `GITHUB_REPOSITORY` | Used by consistency tests — format: `owner/repo` |
| `GITHUB_TOKEN` | GitHub API token for consistency tests |

`dotenv` loads `.env.local` automatically at startup — set variables there for local runs. Never commit `.env.local`.

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

# Validate job URLs from SOLR by CIF (check active/expired)
node validate-jobs.js <CIF>

# Validate a single job URL
node validate-jobs.js url <url>

# Delete expired jobs from SOLR by CIF
node validate-jobs.js <CIF> --delete
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

## Temporary Files

All temporary/scratch files must be placed in `tmp/` inside the project root (never outside the project). The `tmp/` directory is in `.gitignore` and will not be committed.

## Technical Debt / Completed

- [x] Extract demoanaf.js to separate module (#2)
- [x] Write Unit Tests for all modules (#3)
- [x] Write Integration Tests in separate folder (#4)
- [x] Write E2E automated tests in separate folder (#5)
- [ ] Write Unit/Component/E2E tests for index.js