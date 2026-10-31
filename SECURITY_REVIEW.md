# Review scope for the v1.24.4-based rebuild

This build restores the supplied v1.24.4 authentication and configuration implementation. The previous review of v1.26.0 described session isolation, revocation, TLS/redirect restrictions, and OAuth changes that are not part of this rebuild. Those findings must not be treated as validation of the restored sign-in code.

This rebuild retains diagnostic redaction and readable log viewing, public error boundaries, restricted API-photo loading, staged update installation, and the existing updated build dependencies. Authentication preservation is checked against fingerprints of the v1.24.4 source, while network tests use simulated Scriptable requests. No real credentials, OTP messages, or vehicle commands are used by the tests.

The supplied build SHA-256 is `3c24d58504ecdcc3fcbbacb07ee36c4709f1881637eb5fc38963fe94bdbb5f97`, an exact match for the repository's v1.24.4 release. The baseline fixture is generated from that tag. Only observational log-secret registration is excluded from authentication method comparisons.
