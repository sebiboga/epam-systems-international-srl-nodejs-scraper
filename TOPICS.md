# Topics — Repo GitHub About

Topics (etichetele) din secțiunea **About** a repo-ului pe GitHub se adaugă cu `gh repo edit --add-topic <nume>` sau manual în Settings → General → Topics.

## Topic-uri active

| Topic | Descriere |
|-------|-----------|
| `job-seeker-ro-spider` | Numele scraperului (User-Agent-ul folosit în toate request-urile HTTP) |
| `peviitor-ro` | Platforma pentru care se face scraping-ul |

## Reguli

- GitHub topics acceptă doar litere mici, cifre și **hyphens** (`-`). Underscore (`_`) nu e permis.
- Maxim 50 de caractere per topic.
- Adăugăm topic-uri noi doar cu issue în GitHub Issues înainte.

## Adăugare topic nou

```bash
gh repo edit <owner>/<repo> --add-topic <nume-topic>
```

sau manual pe `https://github.com/<owner>/<repo>/settings`.
