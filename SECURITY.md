# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 1.x     | :white_check_mark: |

## Reporting a Vulnerability

If you discover a security vulnerability, please report it by:

1. **Do NOT** create a public GitHub issue
2. Email the maintainer directly
3. Include a detailed description of the vulnerability
4. Provide steps to reproduce

We will respond within 48 hours and work with you to address the issue.

## ⚠️ CRITICAL: Credential Rules

**NEVER put credential values in ANY file in this repository — not in source code, not in documentation, not in tests, not in examples.**

Specifically:

### Golden Rule

**Credentialele se țin EXCLUSIV în `.env.local`** (care e în `.gitignore`).
**NU se pun în niciun fișier din repository, niciodată.**

### Source code
- NEVER use fallback defaults like `process.env.X || "anything"`
- NEVER hardcode passwords, tokens, or secrets in `.js` files
- Always read credentials from environment variables with NO fallback

### Documentation (`.md` files)
- NEVER write `SOLR_AUTH=solr:your-solr-credentials` or similar
- If a value is needed in an example, use a clearly fake placeholder like `your-solr-credentials`

### Git history
- If a credential is accidentally committed, it MUST be removed from history (not just the latest commit)
- Use `git filter-branch` or `git filter-repo` to purge it
- Force push after cleanup

### Enforced by review
- Every PR must be checked for hardcoded credentials
- Any file containing credential patterns will be rejected

## Security Best Practices

- Never commit `.env` files or credentials to the repository
- Store secrets in GitHub Secrets for CI/CD
- Rotate credentials regularly
- Review Solr access permissions

## Dependencies

This project uses `npm audit` to check for vulnerable dependencies. Run:

```bash
npm audit
```

Keep dependencies up to date with:

```bash
npm update
```
