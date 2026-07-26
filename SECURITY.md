# Security Policy

## Supported Versions

WorthLog is actively developed, and security updates are provided for the latest available version only.

| Version | Supported |
| ------- | --------- |
| Latest  | ✅ Yes    |
| Older versions | ❌ No |

Users are encouraged to keep their WorthLog installation up to date.

## Reporting a Vulnerability

Please do not report security vulnerabilities through public GitHub issues, discussions, or social media.

Instead, use GitHub's **Private Vulnerability Reporting** feature:

1. Open the **Security** tab of the WorthLog repository.
2. Select **Report a vulnerability**.
3. Provide as much information as possible about the issue.

Please include:

- A clear description of the vulnerability
- Steps to reproduce the issue
- The affected WorthLog version
- The potential security impact
- Any relevant logs, screenshots, or proof-of-concept code
- Suggested fixes, if available

Please remove passwords, API keys, personal financial information, access tokens, and other sensitive data from your report.

## Response Process

After receiving a security report, I will aim to:

- Acknowledge the report within 7 days
- Review and validate the reported issue
- Provide updates when meaningful progress has been made
- Develop and release a fix when the vulnerability is confirmed
- Publish a security advisory when appropriate

Response and resolution times may vary depending on the complexity and severity of the issue.

## Responsible Disclosure

Please allow reasonable time for the vulnerability to be investigated and fixed before sharing details publicly.

I appreciate responsible disclosure and the time taken to help make WorthLog safer for everyone.

## Scope

Security reports may include vulnerabilities related to:

- Authentication and PIN protection
- Unauthorized access to portfolio data
- Exposure of sensitive information
- Session handling
- API endpoints
- Docker configuration
- Dependency vulnerabilities
- Cross-site scripting
- Injection vulnerabilities
- Access control issues

General feature requests, installation problems, and non-security bugs should be submitted through the regular GitHub issue tracker.

## Security Recommendations

WorthLog is designed to be self-hosted. Users are responsible for securing their own environment.

Recommended precautions include:

- Keep WorthLog and its dependencies updated
- Use strong and unique credentials
- Do not expose WorthLog directly to the public internet without proper authentication
- Use HTTPS when accessing WorthLog remotely
- Place the application behind a trusted reverse proxy
- Restrict network access where possible
- Secure and regularly back up persistent application data
- Never commit secrets or environment files to a public repository

Thank you for helping keep WorthLog secure.
