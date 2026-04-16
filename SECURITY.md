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

## Security Best Practices

When using this project:

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
