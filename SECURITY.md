# Security

The 0.1.0 source, registry packages, and deployed site have separate release evidence. Do not interpret a specification check, source tag, or package badge as universal security certification.

Do not post secrets, real employee data, tenant data, exploit credentials, or active customer incident details publicly. Use **Security → Report a vulnerability** in the [official GitHub repository](https://github.com/Arconath/aeliqo/security/advisories/new). GitHub private vulnerability reporting was verified enabled on September 10, 2026. If that private form is unavailable, do not publish the report; wait for the repository owner to restore or identify a private channel. No monitored security email address or response-time SLA is claimed.

Authorization belongs at the application data/action execution boundary, even after scoped discovery. Refer to docs/13-security-enterprise.md for threat model and release gates. Reproduce with synthetic minimal cases. Releases require dependency/license/SBOM review and actual isolation tests.
