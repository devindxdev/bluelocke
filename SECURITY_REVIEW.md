# Review scope for the v1.24.4-based rebuild

This build restores the supplied v1.24.4 authentication and configuration implementation. The previous review of v1.26.0 described session isolation, revocation, TLS/redirect restrictions, and OAuth changes that are not part of this rebuild. Those findings must not be treated as validation of the restored sign-in code.

This rebuild retains diagnostic redaction and readable log viewing, public error boundaries, restricted API-photo loading, staged update installation, and the existing updated build dependencies. Authentication preservation is checked against fingerprints of the v1.24.4 source, while network tests use simulated Scriptable requests. No real credentials, OTP messages, or vehicle commands are used by the tests.

The supplied build SHA-256 is `3c24d58504ecdcc3fcbbacb07ee36c4709f1881637eb5fc38963fe94bdbb5f97`, an exact match for the repository's v1.24.4 release. The baseline fixture is generated from that tag. Only observational log-secret registration is excluded from authentication method comparisons.

## PR #3 — Hyundai Europe integration (2026-10-31)

Reviewed all 11 changed files at head `23d7d45a823d08de029ca35bd3142ba9b7c9c6f0`: package/build configuration, four EU helper modules, the Europe adapter, logger changes, tests, and generated-build metadata/URL hosts. The authored source contains no unexpected credential destination, analytics collector, remote-code loader, shell execution, or unrelated filesystem/Keychain writes. Tests only create and remove their own temporary bundle directory. The PR-generated build is not carried into this release; the asset is regenerated locally.

Hyundai identity/CCI hosts, the OneApp client ID, and the five-stage encrypted-password/token-exchange flow were cross-checked against the upstream [EU client](https://github.com/Hyundai-Kia-Connect/hyundai_kia_connect_api/blob/master/hyundai_kia_connect_api/KiaUvoApiEU.py). This corroborates the protocol; it is not a guarantee of live account compatibility.

The sole added dependency is `@noble/hashes@1.8.0`, from `https://registry.npmjs.org/@noble/hashes/-/hashes-1.8.0.tgz`, with registry integrity `sha512-jCs9ldd7NwzpgXDIf6P3+NrHh9/sD6CQdxHyjQI+h/6rDNo88ypBxxz45UDuZHz9r3tNz7N/VInSVoVdtXEI4A==`. No dependency lifecycle scripts were executed, and no existing package versions were changed. The audit reports no advisory for this added dependency. Existing development tooling has 12 moderate and 2 low audit entries; unrelated dependency updates were not included.

Integration deliberately retains the PR’s own login/callback/RSA behavior and the existing shared transport configuration, including its certificate-validation setting, at the user’s request. No additional hardening was applied. Existing global diagnostic redaction already covers the new token fields, so the PR’s older logger implementation is not copied. The build retains the required MIT notices.

Tests pin the four helper modules and three changed EU authentication methods to the reviewed PR source. Other authentication/cache methods remain checked against v1.24.4. The original contributor’s mocked login, refresh, encryption, status, and log tests are included alongside regional integration tests. This review found no malicious behavior; it does not certify the provider service, native platform, or live login success.
