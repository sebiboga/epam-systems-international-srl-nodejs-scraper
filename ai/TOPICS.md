# TOPICS.md — Repository GitHub Topics

Toate scraper-urile derivate din acest template **MUST** avea **EXACT 2 topic-uri**:

| Topic | Descriere |
|-------|-----------|
| `job-seeker-ro-spider` | Numele scraperului (User-Agent-ul folosit în toate request-urile HTTP) |
| `peviitor-ro` | Platforma pentru care se face scraping-ul |

## Reguli stricte

1. **EXACT 2 topic-uri** — NICIUN topic în plus, NICIUN topic lipsă.
2. Litere mici, cifre și **hyphens** (`-`) — underscore (`_`) nu e permis.
3. Maxim 50 de caractere per topic.
4. Orice abatere trebuie discutată în GitHub Issues înainte.

## Cum verifici

```bash
gh repo view <owner>/<repo> --json repositoryTopics
```

## Cum setezi

```bash
gh repo edit <owner>/<repo> --add-topic job-seeker-ro-spider --add-topic peviitor-ro
```

sau manual pe `https://github.com/<owner>/<repo>/settings`.
