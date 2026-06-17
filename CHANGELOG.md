# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.4.0] - 2026-06-17

### Added
- `src/job-validator.js` — shared validation primitives (`validateByHead`, `validateByContent`)
- Unit tests for the new module (9 tests)

### Changed
- `validate-jobs.js` and `tests/validate-epam-jobs.js` are now thin CLIs that delegate to `src/job-validator.js` and `solr.js` (closes #35)
- `tests/validate-epam-jobs.js` no longer reimplements SOLR auth, query, or delete — uses `querySOLR` + `deleteJobByUrl` from `solr.js`

## [1.3.0] - 2026-06-17

### Added
- `config/company.json` and `config/company.js` — single source of truth for company identity (CIF, brand, URLs, API config)
- ANAF data caching honoured at root `company.json` (committed to repo) — CI no longer hits demoANAF on every scrape; refresh threshold is 7 days
- Graceful fallback to stale cache if ANAF is unreachable
- `docs/company.json` regenerated on each scrape so the live page reads company identity dynamically

### Changed
- `index.js`, `company.js`, `demoanaf.js`, `tests/validate-epam-jobs.js`, `docs/index.html`, `automation-testing.yml` all now read from `config/company.json` instead of hardcoded constants
- CONTRIBUTING.md derivation checklist simplified — editing `config/company.json` is now the primary step

### Fixed
- Stale company.json at repo root was being ignored — codepath only checked `tmp/company.json` which is gitignored, causing every CI run to refetch from ANAF

## [1.2.0] - 2026-06-17

### Added
- Explicit "template repository" framing across README, AGENTS, CONTRIBUTING
- CONTRIBUTING.md now includes a step-by-step checklist for deriving a scraper for a new company
- Rate-limiting and politeness settings table in instructions.md

### Fixed
- CI workflows: moved `git pull --rebase` before `npm install` to avoid dirty-tree rebase failures
- PUBLIC.md test path (`tests/unit/` → `tests/consistency/`)

## [1.1.0] - 2026-06-17

### Added
- `src/markdown-generator.js` — generates `docs/jobs.md` with company info and all scraped jobs
- `docs/jobs.md` committed to repo after each scrape run (available on GitHub Pages)
- "Jobs MD" button in `docs/index.html` linking to `docs/jobs.md` (opens in new tab)
- Workflow updated to commit `docs/jobs.md` alongside test results

## [1.0.0] - 2026-04-16

### Added
- Initial release
- Job scraping from EPAM Careers Romania API
- Company validation via ANAF
- Solr integration for job storage
- GitHub Actions workflows for daily scraping and testing
- Comprehensive test suite (unit, integration, E2E)
- ANAF API fallback with cached data support
- Node 24 compatibility

### Features
- Automated daily job scraping
- Company core validation and management
- Job URL validation
- Data integrity checks
- Romanian location filtering
- Work mode normalization

## License

Copyright (c) 2024-2026 BOGA SEBASTIAN-NICOLAE
Licensed under MIT License
