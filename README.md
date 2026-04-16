# EPAM Systems International SRL - Job Scraper

A Node.js scraper for extracting job listings from EPAM Careers Romania and storing them in Solr for [peviitor.ro](https://peviitor.ro).

## Overview

This project automates the daily scraping of EPAM job listings in Romania, ensuring the peviitor.ro job board stays up-to-date with the latest career opportunities.

## Features

- Scrapes job listings from EPAM Careers Romania API
- Validates company data via ANAF (Romanian National Employment Agency)
- Stores jobs in Solr with proper data validation
- GitHub Actions workflow for daily automated scraping
- Comprehensive test suite for reliability

## Project Structure

```
├── index.js           # Main scraper entry point
├── company.js         # Company validation via ANAF
├── demoanaf.js        # ANAF API integration
├── solr.js            # Solr database operations
├── company.json       # Cached company data
├── tests/             # Test suite
│   ├── unit/
│   ├── integration/
│   └── e2e/
├── .github/
│   └── workflows/
│       ├── scrape.yml     # Daily scraping workflow
│       └── test.yml      # Test automation
└── package.json
```

## Setup

### Prerequisites

- Node.js 24+
- npm

### Installation

```bash
npm install
```

### Configuration

Set the `SOLR_AUTH` environment variable with your Solr credentials:

```bash
export SOLR_AUTH="username:password"
```

## Usage

### Run the Scraper

```bash
npm run scrape
```

### Run Tests

```bash
# All tests
npm test

# Unit tests only
npm run test:unit

# Integration tests
npm run test:integration

# E2E tests
npm run test:e2e
```

## Workflows

### Daily Scraping

The `scrape.yml` workflow runs daily at 6 AM UTC via GitHub Actions. It:
1. Validates company data via ANAF
2. Scrapes current job listings from EPAM Careers
3. Updates Solr with new/removed jobs
4. Uploads job data as artifacts

### Test Automation

The `test.yml` workflow runs on every push and pull request. It:
1. Ensures EPAM exists in the company core
2. Runs unit, integration, and E2E tests
3. Validates data integrity in Solr

## License

Copyright (c) 2024-2026 BOGA SEBASTIAN-NICOLAE

Licensed under the [MIT License](LICENSE).

## Managed By

This project is managed by [ASOCIATIA OPORTUNITATI SI CARIERE](https://peviitor.ro) and used as a web scraper for the [peviitor.ro](https://peviitor.ro) job board project.

## Disclaimer

This scraper is designed for educational purposes and legitimate job data aggregation for the Romanian job market. Please respect EPAM's Terms of Service and robots.txt when using this scraper.
