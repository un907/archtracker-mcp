# Security Policy

## Supported Versions

| Version | Supported          |
|---------|--------------------|
| 0.1.x   | :white_check_mark: |

## Reporting a Vulnerability

If you discover a security vulnerability, please report it responsibly:

1. **Do not** open a public issue
2. Email the maintainer or use [GitHub Security Advisories](https://github.com/un907/archtracker-mcp/security/advisories/new)
3. Include:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact

We will respond within 48 hours and aim to release a fix within 7 days for critical issues.

## Security Measures

archtracker-mcp implements the following security measures:

- **Path traversal protection**: All file operations are validated against the project root boundary
- **No network access**: The MCP server and CLI operate entirely locally
- **No code execution**: Static analysis only — no user code is executed
- **Input validation**: All MCP tool inputs are validated with Zod schemas
