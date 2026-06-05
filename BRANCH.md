# BRANCH.md — Default Branch Must Be `main`

All scrapers derivate din acest template **MUST** folosi `main` ca default branch.

## De ce `main`?

- `master` este o denumire veche (legacy), GitHub recomandă `main` din 2020
- Toate repo-urile noi pe GitHub au `main` ca default
- Consistență între toate scraper-ele

## Reguli

1. Default branch **MUST** fie `main` — NU `master`, `develop`, sau altceva.
2. Orice branch `master` existent trebuie redenumit în `main`.
3. Verificare: `gh repo view <owner>/<repo> --json default_branch`

## Cum redenumești

```bash
# Creează branch-ul main pe același commit ca master
gh api repos/<owner>/<repo>/git/refs -f ref="refs/heads/main" -f sha=$(gh api repos/<owner>/<repo>/git/refs/heads/master --jq '.object.sha')

# Schimbă default branch
gh api repos/<owner>/<repo> -X PATCH -f default_branch="main"

# Șterge branch-ul master
gh api repos/<owner>/<repo>/git/refs/heads/master -X DELETE
```
