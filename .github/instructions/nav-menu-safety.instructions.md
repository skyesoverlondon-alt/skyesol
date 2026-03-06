---
description: "Use when editing header/nav/mega-menu behavior in js/main.js, partials/header.html, or css/style.css. Prevent top-right MENU regressions and blank/box-only menu states."
name: "Nav Menu Safety"
applyTo: "js/main.js,partials/header.html,css/style.css"
---
# Nav Menu Safety Rules

- Treat the top-right `MENU` flow as critical UX. Make minimal edits.
- Do not rewrite authored mega-nav markup (`#megaNav` and `.mega-nav-col`) unless explicitly requested.
- In `js/main.js`, initialize mega-nav only after DOM is ready.
- If a page already has authored mega-nav columns, preserve them.
- Only generate fallback menu structure when authored columns are missing.
- Do not change selectors globally if scope can be narrowed to `.main-nav`.

## Required Checks After Nav Edits

- Verify `MENU` opens and closes from the far-right header button.
- Verify menu labels are visible (not blank) in desktop layout.
- Verify no folder-box conversion appears on pages with authored mega-nav HTML.
- Verify mobile nav still expands/collapses and dropdowns remain clickable.
- Review diff to ensure only intended nav files changed.

## Safe Edit Pattern

- Prefer one-file fixes first.
- If CSS must change, scope selectors to avoid collisions with page-local nav classes.
- Keep fallback behavior deterministic and non-destructive.
