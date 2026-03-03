# SkyeProofx (SkyeProofx Proof Vault)

SkyeProofx is a **client-side** proof vault. You drag & drop files (PDFs, docs, images, zips — anything), set a password, and it exports a single **encrypted vault ZIP** that contains:

- `manifest.json` — file list + SHA-256 receipts + encryption parameters
- `HASHES.txt` — human-readable SHA-256 receipts (`<sha256>  <filename>`)
- `proof.json` — vault metadata + manifest SHA-256
- `encrypted/*` — AES-GCM encrypted bytes for each file

## What “locked behind PW” means (important)

This app encrypts the files **in your browser** using AES‑GCM with a key derived from your password using PBKDF2 (SHA‑256).  
No server is required. No files are uploaded.

If you lose the password, the vault is **unrecoverable**.

## Deploy (Netlify Drop-ready)

This is a static site.

- Publish directory: the folder containing `index.html` (this folder)
- No environment variables required

## Use

### Create Vault
1. Open the app
2. Drop files
3. Set password + confirm
4. Click **Build & Download Vault (.zip)**

### Open Vault
1. Go to **Open Vault**
2. Drop the vault zip
3. Enter password
4. Decrypt & download files as needed

### Verify Originals
1. Go to **Verify Originals**
2. Drop `manifest.json` (or the full vault zip)
3. Drop original files
4. Click **Run Verification**

## Notes
- ZIP output is created in STORE mode (no compression) to reduce CPU and avoid compatibility problems.
- SHA-256 receipts prove integrity; encryption enforces confidentiality.

## License notes
This project embeds a minimal ZIP implementation derived from **fflate** (MIT).
