# job_seeker_ro_spider

**job_seeker_ro_spider** — scraper pentru job-urile EPAM Systems din România.

Extrage anunțurile de pe [EPAM Careers Romania](https://careers.epam.com/en/jobs/romania) și le publică în [peviitor.ro](https://peviitor.ro) prin API-ul Peviitor.

## Identificare

Toate request-urile HTTP folosesc User-Agent-ul:

```
job_seeker_ro_spider
```

## Ce face

1. **Validează compania** — interoghează API-ul public ANAF ([demoanaf.ro](https://demoanaf.ro)) după CIF-ul EPAM (33159615) și verifică:
   - Denumirea oficială: EPAM SYSTEMS INTERNATIONAL SRL
   - Status: activ/inactiv/radiat
   - Adresa completă din registrul comerțului
2. **Cross-validează cu Peviitor** — verifică existența companiei în API-ul Peviitor
3. **Scrape-uiește job-urile** — extrage lista completă de job-uri din API-ul public EPAM Careers, filtrat pe România
4. **Transformă datele** — normalizează locațiile (doar orașe românești), tag-urile (lowercase), workmode-ul (remote/on-site/hybrid)
5. **Stochează în Peviitor** — upsert prin API-ul Peviitor (job-uri și date companie)
6. **Generează jobs.md** — fișier markdown cu informații companie + toate job-urile curente

## API-uri folosite

| API | URL | Autentificare |
|---|---|---|
| EPAM Careers | `https://careers.epam.com/api/jobs/v2/search/...` | Public |
| ANAF (demoanaf) | `https://demoanaf.ro/api/...` | Public |
| Peviitor | `https://api.peviitor.ro/v1/company/` | Public |

## Robots.txt

EPAM Careers [robots.txt](https://careers.epam.com/robots.txt) dezactivează:
- `/api/*` — API-ul JSON folosit de scraper
- `/*/vacancy/*` — paginile individuale de job

Scraper-ul folosește API-ul cu rate limiting (1s delay între pagini, 10 job-uri/cerere) și un singur User-Agent identificabil. Paginile individuale de job sunt doar verificate (HEAD request), nu parse-uite.

Pentru analiza completă, vezi [ai/ROBOTS.md](../ai/ROBOTS.md).

## Testare

```bash
# Toate testele
npm test

# Doar unitare
npm run test:unit

# Doar integrare (necesită ANAF live, Peviitor API conditional)
npm run test:integration

# Doar E2E (API real EPAM + ANAF + Peviitor)
npm run test:e2e
```

Testele Peviitor API folosesc `itIfApi` — se auto-skip dacă API-ul Peviitor nu e disponibil.
