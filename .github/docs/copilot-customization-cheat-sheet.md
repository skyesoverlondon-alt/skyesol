# Copilot Customization Cheat Sheet

## Zero-Memory Mode (Copy/Paste)

Use this when you do not want to remember anything.

1. Fix menu safely (top-right header MENU issues):
- `Follow nav-menu-safety and fix the top-right MENU in header.`

2. Edit redirects safely:
- `/safe-redirect-edit <exact route change needed>`

3. Run release checks before deploy:
- `@Release Guard pre-release check`

4. Start local server with functions:
- `netlify dev`

## If You Only Remember 3 Lines

- Menu broken: `Follow nav-menu-safety and fix header MENU only.`
- Redirects: `/safe-redirect-edit ...`
- Pre-release: `@Release Guard`

## Slash Commands You Asked For

1. `/safe-redirect-edit <what to change>`
- Purpose: Safe `_redirects` edits with encoding + 200/301 validation.
- Example: `/safe-redirect-edit add rewrite for /blogs/editorials/colorado%20ai/* to Colorado AI folder`

2. `@Release Guard <optional scope>`
- Purpose: Pre-release readiness checks.
- Runs: build, sitemap, link checks, internal-link audit, meta check.
- Example: `@Release Guard validate before deploy for blog/nav changes`

3. `nav-menu-safety` instruction (auto)
- Applies automatically when editing:
  - `js/main.js`
  - `partials/header.html`
  - `css/style.css`
- Purpose: Prevent far-right `MENU` regressions.

## Fast Workflow

1. Editing menu/nav:
- Edit only one nav file first.
- Verify top-right `MENU` opens, labels render, closes correctly.
- Avoid rewriting authored `#megaNav` unless explicitly requested.

2. Editing redirects:
- Use `/safe-redirect-edit ...`
- Confirm `%20` encoding and route precedence.
- Confirm `200` (rewrite) vs `301` (redirect) intent.

3. Before release:
- Run `@Release Guard`
- Resolve blockers first, then warnings.

## Quick Commands (Manual)

- `npm run build`
- `npm run gen-sitemap`
- `npm run link-check`
- `npm run audit:internal-links`
- `npm run meta:check`
- `netlify dev`

## Memory Hooks (So You Don’t Re-Explain)

- Keep this file as your quick reminder.
- Repo memory already records menu safety rules in `/memories/repo/skyesol-branding-notes.md`.
