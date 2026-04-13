# Job Model Schema

## Required Fields

| Field  | Type   | Description |
|--------|--------|-------------|
| url    | string | Full URL to job detail page. Must be valid HTTP/HTTPS URL |

| title  | string | Position title. Max 200 chars, no HTML, trimmed whitespace. DIACRITICS ACCEPTED (ăâîșțĂÂÎȘȚ) |

## Optional Fields

| Field            | Type     | Description |
|------------------|----------|-------------|
| company          | string   | Hiring company name. Legal name, uppercase, DIACRITICS ACCEPTED |
| cif              | string   | CIF/CUI (8 digits, no RO prefix) |
| location         | string[] | Romanian cities/addresses. DIACRITICS ACCEPTED. Multi-valued array |
| tags             | string[] | Skills/education/experience. Lowercase, max 20 entries, NO DIACRITICS |
| workmode         | string   | "remote", "on-site", or "hybrid" |
| date             | date     | Scrape date. ISO8601 UTC timestamp (ex: "2026-01-18T10:00:00Z") |
| status           | string   | "scraped", "tested", "published", or "verified". Default: "scraped" |
| vdate            | date     | Verified date. ISO8601. Set only when status="verified" |
| expirationdate   | date     | Estimated job expiration. ISO8601 |
| salary           | string   | Salary range + currency. Format: "MIN-MAX CURRENCY" (ex: "5000-8000 RON") |

## Status Flow

`scraped` → (`tested` OR `verified`) → `published`

| Status     | Meaning                              |
|------------|--------------------------------------|
| scraped    | Newly scraped, not validated yet    |
| tested     | URL works, job exists but incomplete details |
| verified   | Fully scraped with all details      |
| published  | Imported from jobs core             |

## Notes

- Fields marked `string[]` are multi-valued arrays stored as arrays in SOLR/OpenSearch
- tags must be lowercase with NO diacritics
- location accepts diacritics (București, Cluj-Napoca)
- title accepts diacritics
- company must be uppercase
- salary must be a string, not an array