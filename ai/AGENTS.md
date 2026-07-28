# AGENTS.md — Rules for AI agents

## Project
EPAM scraper for peviitor.ro (Node.js, ESM, Jest)

## 📐 This Repo Is a Template
This repo is the **reference implementation** for all Node.js scrapers in the peviitor.ro ecosystem. Other scrapers are derived from it.

When making changes:
- **All company-specific identity lives in `scraper/config/company.json`** (CIF, brand, legalName, URLs, API params). Read from `scraper/config/company.js` in Node code, or via `jq` in workflows. Never hardcode in source files.
- **Only the API parsing logic in `scraper/index.js`** (`fetchJobsPage`, `parseApiJobs`) is EPAM-specific. The output shape (`mapToJobModel`, `transformJobsForSOLR`) must stay uniform across derived scrapers.

## Critical Rules

### 0. Background tasks — always pass `--repo` explicitly to `gh`

When polling a workflow run with `until [ "$(gh run view ID --json status -q .status)" = "completed" ]; do sleep N; done`, the `gh run view` command implicitly uses the current working directory's git remote. If the CWD is a different repo (e.g. you cd-ed elsewhere mid-task), `gh` looks in the wrong repo and returns 404 — the loop's check becomes `"" != "completed"` (always true) and the background task sleeps forever.

**Always specify the repo explicitly:**
```bash
gh run view <RUN_ID> --repo sebiboga/epam-systems-international-srl-nodejs-scraper --json status -q .status
```

Before starting any `gh run watch` or polling loop in the background, sanity-check:
- Does the command include `--repo`?
- Is the run ID from the same repo as `--repo`?

If you spawn a stuck task, kill it immediately rather than letting it hang.

### 1. Temporary Files
All temporary/scratch files MUST go in `tmp/` inside the project root.
NEVER use paths outside the project (e.g. `C:\Users\...\AppData\Local\Temp\opencode`).

### 2. Issues & GitHub
- **Orice modificare de cod trebuie să aibă un issue în GitHub Issues** (vezi [ISSUES.md](ISSUES.md))
- Excepții: typo-uri, whitespace, documentație minoră
- Create a GitHub issue before implementing any change
- Commit messages must reference the issue they close
- Never commit credentials (`.env.local`, `*.pem`, etc.)
- Push after commit

### 3. Environment Variables
- `.env.local` is NOT used — all operations go through the Peviitor API (no direct SOLR access)
- Consistency tests need `GITHUB_REPOSITORY` (format: `owner/repo`) and `GITHUB_TOKEN`

### 4. Testing
```bash
npm run test:unit
npm run test:integration   # needs ANAF
npm run test:e2e           # needs ANAF
npm run test:consistency   # needs GITHUB_REPOSITORY + GITHUB_TOKEN
```

### 5. Commit & Push
- `git add -A && git commit -m "..." && git push`
- Commit messages must reference the related issue
- Never `--force` push
