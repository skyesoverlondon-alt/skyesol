SOLENTEAI DISPATCHES — 13 FULL EDITORIAL PAGES (SVS MASTER TEMPLATE)

What this is:
- 13 standalone editorial pages rebuilt using the Skyes Visual Standard look & structure (stars, glass, gold/purple, proof-pack layout).
- Everything is inline (no Tailwind, no external JS/CSS libs).
- Each page links back to your SolenteAI Dispatches section and includes CTA blocks to:
  - Request a kAIxU API Key: https://skyesol.netlify.app/kaixu/requestkaixuapikey
  - Contact: https://skyesol.netlify.app/contact
  - Main site: https://skyesol.netlify.app/

How to wire your existing Dispatches grid to these pages:
- Your current SolenteAI page uses <article class="cursor-pointer"> cards.
- Easiest approach: wrap each card with an <a href="dispatches/<filename>"> ... </a>, OR add onclick handlers.

Suggested folder placement:
- Put these files in: /dispatches/
- Then link to: /dispatches/<filename>

Manifest:
- manifest.json lists title → filename mappings.

Notes:
- “Company” dispatches are written as editorial strategy memos to avoid representing speculative funding/hiring as formal public filings.
