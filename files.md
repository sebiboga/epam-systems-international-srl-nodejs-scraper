# Project Files

## JavaScript Files

| File | Description |
|------|-------------|
| `index.js` | Main scraper - extracts jobs from EPAM careers page (Romania) |
| `company.js` | Validates company data via ANAF + Peviitor APIs, checks if company is active/inactive |
| `solr.js` | Queries SOLR for existing jobs, validates job fields (cif, company), handles company inactive case (delete jobs + stop) |

## Markdown Files

| File | Description |
|------|-------------|
| `instructions.md` | Project documentation - workflow steps, technologies, API endpoints, how to update models |
| `job-model.md` | Job schema definition (Peviitor Core) - fields, types, validation rules |
| `company-model.md` | Company schema definition (Peviitor Core) - fields, types, validation rules |
| `files.md` | This file - documents role of each project file |

## Configuration Files

| File | Description |
|------|-------------|
| `package.json` | Node.js project config - dependencies (node-fetch, cheerio), scripts |
| `package-lock.json` | Locked dependency versions |

## Data Files

| File | Description |
|------|-------------|
| `jobs_epam_ro.json` | Output file - scraped jobs in JSON format (temporary, before SOLR upsert) |
| `company.json` | Company backup - all ANAF + Peviitor data, used for restore if SOLR data is lost |

## Dependencies (node_modules/)

Installed via npm:
- `node-fetch` - HTTP requests
- `cheerio` - HTML parsing

## Notes

- All `.md` files contain dynamic schemas that may change over time
- Check peviitor_core README.md for latest model definitions
- Workflow is: SOLR check → ANAF validation → Peviitor validation → company status check → scrape → map → upsert