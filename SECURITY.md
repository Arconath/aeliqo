# Security

No v0.1.0 runtime has been released by this kit. Do not interpret specification-check badges as runtime security certification.

Do not post secrets, real employee data, tenant data, exploit credentials or active customer incident details publicly. Use GitHub private vulnerability reporting if the repository owner has enabled it; otherwise request a private reporting channel from the owner without publishing sensitive details. M0 must verify and document an actual reporting channel; no monitored email address is invented here.

Authorization belongs at the application data/action execution boundary, even after scoped discovery. Refer to docs/13-security-enterprise.md for threat model and release gates. Reproduce with synthetic minimal cases. Releases require dependency/license/SBOM review and actual isolation tests. No response-time SLA is promised without a signed support agreement.
