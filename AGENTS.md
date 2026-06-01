# AGENTS.md — Rules for AI agents

## Project
EPAM scraper for peviitor.ro (Node.js, ESM, Jest)

## Critical Rules

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
- `SOLR_AUTH=solr:your-solr-credentials` must be set in `.env.local` for SOLR tests
- `.env.local` is in `.gitignore` — never commit it

### 4. Testing
```bash
# Unit tests (no env vars needed)
npm test

# Integration tests (ANAF public API, SOLR conditional)
node --experimental-vm-modules node_modules/jest/bin/jest.js --testPathPattern=integration --testTimeout=60000

# E2E tests (real EPAM API, SOLR conditional)
node --experimental-vm-modules node_modules/jest/bin/jest.js --testPathPattern=e2e --testTimeout=60000
```

### 5. ESM + Jest
- Use `jest.unstable_mockModule` (NOT `jest.mock`) for mocking ESM modules
- Run with `--experimental-vm-modules` flag
- SOLR tests use conditional `itIfSolr` helper — auto-skip when `SOLR_AUTH` not set

### 6. Module Structure
- `src/anaf.js` — core ANAF library (imported by company.js)
- `demoanaf.js` — CLI wrapper around src/anaf.js
- `company.js` — company validation (ANAF + Peviitor + SOLR)
- `solr.js` — SOLR operations
- `index.js` — main scraper orchestrator
