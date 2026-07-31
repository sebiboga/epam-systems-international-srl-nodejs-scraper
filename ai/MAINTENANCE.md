# Maintenance Agent

## Purpose

The Maintenance Agent keeps the scraper healthy, up-to-date, and bug-free. It monitors open issues, validates code quality, and applies fixes.

## Routine Tasks

### 1. Check GitHub Issues

Before any work, check open issues:

```bash
gh issue list --repo sebiboga/epam-systems-international-srl-nodejs-scraper --state open
```

- Prioritize `critical` label issues first
- Then `bug` label issues
- Then `enhancement` and `documentation`

### 2. Fix All Open Issues

For each open issue:

1. Read the issue body carefully
2. Checkout the repo if not already in it
3. Investigate the root cause (check file paths, field names, schemas)
4. Apply the fix
5. Run relevant tests to verify
6. Commit with issue reference (e.g., `fix: resolve #20`)
7. Push
8. Close the issue with a comment linking the commit

### 3. Validate Field Names / Schemas

After any code change that touches `scraper/config/company.json` or reads from it:

- Verify the field names match the actual schema: `id`, `company`, `brand`, `status`, `location[]`, `website[]`, `career[]`, `scraperFile`
- Check ALL consumers (workflows, HTML, tests) use the correct field names
- Run: `grep -rn "\.id\|\.company\|\.career\[\|\.location\[" .github/ docs/ tests/ scraper/` to find stale references

### 4. Validate Workflows

After any workflow change:

```bash
# Check workflow syntax
actionlint .github/workflows/*.yml || true

# Verify field names in workflows
grep -n "jq -r" .github/workflows/*.yml
```

### 5. Validate Documentation

Ensure docs match reality:

- `ai/files.md` — file paths and descriptions must match actual files
- `ai/company-model.md` — schema must match `scraper/config/company.json`
- `ai/job-model.md` — schema must match actual job documents
- `docs/README.md` — project structure tree must include all directories
- `docs/test-results/index.html` — branding must say "EPAM", not the old template

### 6. Run Full Test Suite

Before any merge or after fixing issues:

```bash
npm test
```

Fix any failures before proceeding.

### 7. Clean Up Stale Files

- Remove tracked files that are gitignored (e.g., `test-report.html`)
- Delete empty directories that shouldn't exist (e.g., `tmp/`)
- Remove old path references in comments and describe blocks (`src/` → `scraper/`)

## Issue Triage

When reviewing issues, categorize:

| Priority | Action |
|----------|--------|
| `critical` | Fix immediately — breaks CI or production |
| `bug` | Fix in next session |
| `enhancement` | Schedule for next sprint |
| `documentation` | Fix when convenient |
| `good first issue` | Delegate or batch with other low-priority work |

## Escalation

If an issue cannot be resolved (e.g., external API broken, SOLR unreachable):

1. Add a comment explaining the blocker
2. Label it `wontfix` or `question` as appropriate
3. Move on to the next issue
