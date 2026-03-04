# SBOM

This repo uses a deterministic lockfile (`package-lock.json`) and generates a CycloneDX SBOM.

Commands:
- `npm run sbom:gen` → produces `sbom.cdx.json` + `sbom.cdx.json.sha256`
- `npm run sbom:sign` → produces `sbom.cdx.json.sig` (requires `SBOM_SIGNING_PRIVATE_KEY_PEM`)
- `npm run sbom:verify` → verifies signature (requires `SBOM_SIGNING_PUBLIC_KEY_PEM`)

CI runs `npm run ci:gate` and enforces SBOM signing on `main`.
