# Project Files

## JavaScript Files — Root

| File | Description |
|------|-------------|
| `index.js` | Main scraper - full workflow: validate company → scrape → transform → upsert → generate docs/jobs.md |
| `company.js` | Validates company via ANAF + Peviitor APIs, checks if company is active/inactive |
| `solr.js` | SOLR operations module - exports querySOLR, deleteJobByUrl, upsertJobs + standalone verify/extract/company commands |
| `demoanaf.js` | CLI entry point for ANAF module (thin wrapper around src/anaf.js) |
| `validate-jobs.js` | **Generic deep validator (manual use).** Full GET requests, parses page body for "no longer available" keywords. Works with any CIF, single URL, or file. Slower but catches soft-404s. Not used by CI. |

## JavaScript Files — src/

| File | Description |
|------|-------------|
| `src/anaf.js` | ANAF API core module - exports getCompanyFromANAF(cif), getCompanyFromANAFWithFallback(cif, cached), searchCompany(brandName) |
| `src/markdown-generator.js` | Generates docs/jobs.md - exports generateJobsMarkdown(companyData, jobs) |
| `src/job-validator.js` | Shared validation primitives - exports validateByHead(url), validateByContent(url, opts), DEFAULT_EXPIRED_KEYWORDS. Used by both `validate-jobs.js` and `tests/validate-epam-jobs.js`. |

## Config — config/

| File | Description |
|------|-------------|
| `config/company.json` | **Single source of truth for company identity.** All scraper code, CI workflows, and the static HTML read from this file. To derive a scraper for a different company, this is the primary file to edit. |
| `config/company.js` | ESM wrapper that imports and exposes `config/company.json` to Node code |

## Test Files — tests/

| File | Description |
|------|-------------|
| `tests/package.json` | Jest config for test suite - experimental VM modules, test scripts (unit/integration/e2e/consistency) |
| `tests/company.json` | Mock ANAF company data for EPAM used in unit tests |
| `tests/validate-epam-jobs.js` | **EPAM-specific fast validator (used by CI).** HEAD requests only, hardcoded EPAM CIF. Called nightly by `automation-testing.yml`. Supports `--dry-run` and `--delete`. |
| `tests/unit/index.test.js` | Unit tests for index.js - parseApiJobs, mapToJobModel, transformJobsForSOLR |
| `tests/unit/company.test.js` | Unit tests for company.js - getCompanyBrand, validateAndGetCompany, fallback caching |
| `tests/unit/solr.test.js` | Unit tests for solr.js - query, upsert, delete, HTTP error handling |
| `tests/unit/demoanaf.test.js` | Unit tests for ANAF search and company retrieval with mocked responses |
| `tests/integration/workflow.test.js` | Integration tests - ANAF live API, Peviitor API, SOLR company/job cores |
| `tests/e2e/scraper.test.js` | E2E tests - full pipeline with real EPAM API, ANAF, and SOLR |
| `tests/consistency/public.test.js` | Verifies repository is public on GitHub |
| `tests/consistency/repo.test.js` | Verifies default branch, GitHub Pages, SOLR_AUTH secret, workflow files |
| `tests/consistency/topics.test.js` | Verifies repository has required topics: job-seeker-ro-spider, peviitor-ro |
| `tests/consistency/workflow-naming.test.js` | Validates workflow file naming conventions |

## Markdown Files

| File | Description |
|------|-------------|
| `instructions.md` | Project documentation - workflow, technologies, API endpoints, how to update models |
| `job-model.md` | Job schema definition (Peviitor Core) - fields, types, validation rules |
| `company-model.md` | Company schema definition (Peviitor Core) - fields, types, validation rules |
| `files.md` | This file - documents role of each project file |
| `AGENTS.md` | Rules for AI agents working on this project |
| `BRANCH.md` | Branch strategy and naming conventions |
| `CHANGELOG.md` | Version history and notable changes |
| `CONTRIBUTING.md` | Contribution guidelines |
| `ISSUES.md` | Issue tracking conventions |
| `PUBLIC.md` | Notes on public visibility and data policies |
| `ROBOTS.md` | robots.txt analysis and scraping policy for EPAM Careers |
| `SECURITY.md` | Security policy and vulnerability reporting |
| `TOPICS.md` | Repository topics documentation |
| `UPDATE-REPO-ABOUT.md` | Instructions for updating repo description/about |
| `VERIFY.md` | Step-by-step verification checklist after changes |

## Configuration Files

| File | Description |
|------|-------------|
| `package.json` | Node.js project config - dependencies (node-fetch), scripts |
| `package-lock.json` | Locked dependency versions |
| `.npmrc` | npm configuration |
| `.gitignore` | Ignores node_modules/, tmp/, .env.local |
| `.env.local` | Local environment variables (SOLR_AUTH) - NOT committed |
| `.github/CODEOWNERS` | Code ownership rules for PR reviews |
| `.github/workflows/job-seeker-ro-spider.yml` | Daily scraping workflow (6 AM UTC) |
| `.github/workflows/automation-testing.yml` | Automated tests on every push/PR |

## Data Files

| File | Description |
|------|-------------|
| `company.json` | **ANAF cache (committed).** Survives between CI runs so the scraper does not hit demoANAF on every scrape. Refreshed when older than 7 days (configurable via `CACHE_MAX_AGE_DAYS` in company.js). |
| `docs/company.json` | Static copy of `config/company.json` regenerated on each scrape. Served by GitHub Pages so the live page can read company identity without hardcoding it in HTML. |
| `delete_request.json` | **Manual maintenance tool** — SOLR payload to delete ALL jobs for CIF 33159615. Use only when you need to wipe EPAM jobs from SOLR entirely. Run with: `curl --user "${SOLR_AUTH}" "https://solr.peviitor.ro/solr/job/update?commit=true" -H "Content-Type: application/json" -d @delete_request.json` |
| `docs/jobs.md` | Scraped jobs in markdown format - company info + all current jobs (generated by CI after each scrape) |

## Notes

- All `.md` schema files (job-model.md, company-model.md) are dynamic — check peviitor_core README.md for updates
- `tmp/` directory holds runtime artifacts (jobs.json, jobs_existing.json) — not committed
- Full workflow: validate company (ANAF+Peviitor) → scrape EPAM → transform → upsert SOLR → generate docs/jobs.md