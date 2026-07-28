# PUBLIC.md — Repository Must Be PUBLIC

All scrapers derived from this EPAM template **MUST** be **PUBLIC** repositories.

## Why?

- Peviitor is an open-source platform
- Job data should be accessible to everyone
- GitHub Pages requires public repos
- Transparency builds trust

## Enforcement

A CI test (`tests/consistency/public.test.js`) verifies this repository is public
using the GitHub API. If the repo is private, the test fails.

## How to check

```bash
gh repo view $OWNER/$REPO --json visibility
```
