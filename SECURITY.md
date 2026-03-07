# Security Policy

## Supported Versions

This project is actively maintained on the `main` branch.

## Reporting a Vulnerability

Please do not open public GitHub issues for security-sensitive reports.

Instead, report vulnerabilities by emailing the maintainers or by using GitHub's private vulnerability reporting for this repository if it is enabled.

When reporting a vulnerability, include:

- a description of the issue
- impact and affected components
- reproduction steps or proof of concept
- any suggested mitigation if available

We will acknowledge valid reports as quickly as possible and work on a fix before public disclosure.

## Scope

Security-sensitive areas in this repo include:

- Cloudflare Worker request handling in `apps/form-worker`
- GitHub App authentication flows in `apps/form-worker` and `apps/update-checker`
- manual trigger auth in `apps/update-checker`
- CI/CD workflows and repository secrets

Please avoid including secrets, private keys, tokens, or personal data in bug reports.
