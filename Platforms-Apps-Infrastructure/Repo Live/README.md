ZipRepoTest Fix v5

This build exists because your deployed v4 showed:
- pills stuck orange (JS not running)
- dropping ZIP did nothing

v5 changes:
- NO service worker
- NO external module script files (inline module script)
- Removes X-Content-Type-Options: nosniff to avoid MIME mismatch blocking
- Uses WebContainers recommended COOP/COEP headers (require-corp + same-origin)
- Uses File System Access API folder picker (showDirectoryPicker) + legacy folder input

Deploy: Netlify Drop with this folder/zip. No env vars.
