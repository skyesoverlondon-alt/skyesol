---
description: "Safely edit _redirects with URL encoding, path-case sensitivity, and 200 rewrite vs 301 redirect checks."
name: "Safe Redirect Edit"
argument-hint: "Describe the route(s) to add/fix and expected behavior"
agent: "agent"
---
Update `/_redirects` using this checklist:

1. Parse request intent:
- Source URL pattern(s)
- Target URL(s)
- Keep URL visible (`200` rewrite) or redirect browser (`301`/`302`)

2. Apply routing safely:
- Preserve existing order unless a precedence bug is identified
- Keep path case sensitivity intact
- Encode spaces and special characters (`%20`, etc.)
- Avoid broad catch-alls that shadow specific routes

3. Validate semantics:
- `200` for internal rewrite (URL unchanged)
- `301` for canonical redirect
- Ensure splat behavior (`:splat`) maps correctly

4. Regression scan:
- Check nearby related routes for collisions
- Confirm category and singleton routes still resolve
- Confirm lower-case aliases if required for shared links

5. Output format:
- Show exact diff entries added/updated
- Briefly explain why each rule uses 200 vs 301
- List 2-3 URLs to test manually
