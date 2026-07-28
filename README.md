[![Oportunitati SI Cariere](https://github.com/sebiboga/epam-systems-international-srl-nodejs-scraper/actions/workflows/job-seeker-ro-spider.yml/badge.svg)](https://github.com/sebiboga/epam-systems-international-srl-nodejs-scraper/actions/workflows/job-seeker-ro-spider.yml)
[![Automation Tests](https://github.com/sebiboga/epam-systems-international-srl-nodejs-scraper/actions/workflows/automation-testing.yml/badge.svg)](https://github.com/sebiboga/epam-systems-international-srl-nodejs-scraper/actions/workflows/automation-testing.yml)
[![Version](https://img.shields.io/github/package-json/v/sebiboga/epam-systems-international-srl-nodejs-scraper?label=version&color=blue)](CHANGELOG.md)
[![Test Results](https://img.shields.io/badge/test--results-HTML-9b59b6)](https://sebiboga.github.io/epam-systems-international-srl-nodejs-scraper/test-results/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![JavaScript](https://img.shields.io/badge/javascript-ESM-F7DF1E?logo=javascript&logoColor=black)](https://ecma-international.org/)
[![Node.js](https://img.shields.io/badge/node-24-339933?logo=nodedotjs&logoColor=white)](https://nodejs.org/)
[![Website](https://img.shields.io/website?url=https%3A%2F%2Fpeviitor.ro&label=peviitor.ro)](https://peviitor.ro)
[![API](https://img.shields.io/website?url=https%3A%2F%2Fapi.peviitor.ro%2F&label=api.peviitor.ro)](https://api.peviitor.ro/)
[![GitHub Pages](https://img.shields.io/github/deployments/sebiboga/epam-systems-international-srl-nodejs-scraper/github-pages?label=GitHub%20Pages)](https://sebiboga.github.io/epam-systems-international-srl-nodejs-scraper/)

# job_seeker_ro_spider — EPAM Careers Romania Scraper

**job_seeker_ro_spider** — un scraper pentru job-urile EPAM Systems din România. Extrage anunțurile de pe [EPAM Careers Romania](https://careers.epam.com/en/jobs/romania) și le publică în [peviitor.ro](https://peviitor.ro) prin API-ul Peviitor.

## Overview

Proiectul automatizează colectarea zilnică a job-urilor EPAM din România, menținând board-ul peviitor.ro la zi cu cele mai recente oportunități de carieră.

## Features

- Extrage job-uri din EPAM Careers API (paginare + filtrare România)
- Job-uri ANOFM suplimentare prin CIF
- Validează compania via ANAF (CUI, status activ/inactiv, adresă completă)
- **Cache ANAF la 7 zile** — committed în repo, nu lovește demoANAF la fiecare scrape
- **Fallback la cache stale** dacă ANAF e indisponibil
- Cross-validează cu Peviitor API
- Șterge job-urile stale (de pe site dar nu și în Peviitor)
- Stochează în Peviitor API (job core + company core)
- Generează `docs/jobs.md` automat — accesibil pe GitHub Pages
- **Identitate companie într-un singur fișier** (`scraper/config/company.json`)
- GitHub Actions: scrape zilnic + testare automată (unit, integration, e2e, consistency)
- Se identifică prin User-Agent: `job_seeker_ro_spider`

## License

Copyright (c) 2024-2026 BOGA SEBASTIAN-NICOLAE

Licensed under the [MIT License](LICENSE).

## Managed By

This project is managed by [ASOCIATIA OPORTUNITATI SI CARIERE](https://oportunitatisicariere.ro) and used as a web scraper for the [peviitor.ro](https://peviitor.ro) job board project.

## Disclaimer

This scraper is designed for educational purposes and legitimate job data aggregation for the Romanian job market.
