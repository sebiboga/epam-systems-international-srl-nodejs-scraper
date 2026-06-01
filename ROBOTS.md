# Robots.txt Analysis — EPAM Careers

Sursa: https://careers.epam.com/robots.txt

## Reguli

```
User-agent: LinkedInBot
Allow: /

User-agent: *
Disallow: /en/application
Disallow: /ru/application
Disallow: /api
Disallow: /api/*
Disallow: /*?skill*
Disallow: /*?search*
Disallow: /*?query*
Disallow: /*?specialization*
Disallow: /*?utm*
Disallow: /none
Disallow: /*?ref*
Disallow: /*?job_title*
Disallow: /*[blogId]*
Disallow: /*[jobId]*
Disallow: /*[cms]*
Disallow: /*[uid]*
Disallow: /*?page*
Disallow: /*?gclid*
Disallow: /blog
Disallow: /blog/*
Disallow: /*/vacancy/*
Disallow: /ai-interviewer
Disallow: /ai-interviewer/*
```

## Interpretare

| Cale | Accesibil? | Ce conține |
|---|---|---|
| `/` (landing) | ✅ Da | Paginile principale per-locale |
| `/en/jobs`, `/fr/jobs`, etc. | ✅ Da | Listări de job-uri (front-end) |
| `/api/*` | ❌ **Disallowed** | API-ul JSON de la care scraper-ul nostru extrage datele |
| `/*/vacancy/*` | ❌ **Disallowed** | Paginile individuale de job |
| `/en/application` | ❌ Disallowed | Pagina de aplicare |
| `/blog/*` | ❌ Disallowed | Blogul |
| `/ai-interviewer/*` | ❌ Disallowed | Intervievator AI |

## Recomandare

robots.txt NU este legal binding, dar reprezintă intenția proprietarului site-ului.

- API-ul `/api/jobs/v2/search/...` e **disallowed** de robots.txt. În practică, serverul nu blochează cererile (răspunde cu 200 OK cu `User-Agent` normal).
- Paginile individuale de job (`/en/vacancy/...`) sunt și ele disallowed. Noi nu le scraper-uim direct — doar le verificăm accesibilitatea (HEAD request) în E2E tests.
- Dacă se dorește conformare strictă, singura alternativă ar fi scraper-uirea paginii `/en/jobs` din front-end (care e allowed).
- Scraperul curent face o singură cerere per pagină (10 job-uri) cu delay de 1s între pagini — comportament rezonabil, nu agresiv.

**Concluzie**: Risc minim. API-ul e public, răspunde fără autentificare, iar scraperul e politicos (rate limiting, User-Agent standard, o singură cerere simultană).
