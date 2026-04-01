# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 1.0.x   | :white_check_mark: |

## Privacy Architecture

This project is designed with a privacy-first architecture:

- **All processing happens locally** on your machine
- **No data is uploaded** to any external service
- **DNA files stay on disk** in the project directory
- **LLM calls** go to your configured provider (Anthropic, OpenAI, etc.) but only send variant-level queries, not your raw DNA file
- **Annotation databases** are built from public data sources — no proprietary databases

## Reporting a Vulnerability

If you discover a security vulnerability, please report it responsibly:

1. **Do NOT open a public GitHub issue** for security vulnerabilities
2. Email **admin@helixsequencing.com** with:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if any)
3. You will receive a response within 72 hours
4. We will work with you to understand and address the issue before any public disclosure

## Scope

Security concerns we take seriously:

- **Data leakage**: Any path where raw DNA data could leave the user's machine unintentionally
- **Injection attacks**: Malicious input in DNA files, config files, or preset YAML that could execute arbitrary code
- **Dependency vulnerabilities**: Known CVEs in our npm dependencies
- **LLM prompt injection**: Crafted inputs that could manipulate agent behavior to exfiltrate data

## Best Practices for Users

- Keep your `.env` file out of version control (it's in `.gitignore`)
- Run the tool on a trusted machine — your DNA data is sensitive
- Review the generated report before sharing it with anyone
- Keep dependencies updated: `npm audit` and `npm update`
- Use the latest release for security patches
