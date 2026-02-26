/* /assets/zip.js — pack builder helper (JSZip + templates) */
/* global JSZip */

(function() {
  "use strict";

  const DOCS = {
    "README.md": (ctx) => `# Business Launch Kit (AZ) Pack — ${ctx.businessName}\n\nGenerated for **${ctx.businessName}** in **${ctx.city}, AZ** (Industry: **${ctx.industry}**).\n\nThis pack includes:\n- Arizona launch checklist\n- Banking checklist\n- Operations foundation notes\n- Website launch checklist\n- Client intake template\n- Invoice template (CSV)\n- Policy starters (privacy/terms bullet starters)\n\n## How to use\n1. Start with **az-launch-checklist.md** and check off items.\n2. Set up banking using **banking-checklist.md**.\n3. Build internal routines using **ops-foundation.md**.\n4. Launch the website using **website-launch-checklist.md**.\n5. Use **client-intake-template.txt** for discovery calls.\n6. Use **invoice-template.csv** as a clean invoicing starter.\n7. Draft privacy/terms with **policy-starters.md** and have counsel review.\n\n> Not legal/tax advice. For legal/tax decisions, use a licensed professional.\n\nGenerated: ${ctx.generatedAt}\n`,

    "az-launch-checklist.md": (ctx) => `# Arizona Launch Checklist — ${ctx.businessName}\n\n**Business:** ${ctx.businessName}\n**City:** ${ctx.city}, AZ\n**Industry:** ${ctx.industry}\n**Owners:** ${ctx.ownersCount}\n**Hiring employees:** ${ctx.hireEmployees ? "Yes" : "No"}\n\n---\n\n## Phase 1 — Foundation\n- [ ] Decide entity type (LLC / Corporation / Partnership)\n- [ ] Choose business name (search availability; consider trademark search)\n- [ ] Define ownership splits and roles (operating agreement / bylaws)\n- [ ] Select registered agent (required for most entities)\n- [ ] Create a business email + domain\n\n## Phase 2 — Formation & IDs\n- [ ] Form entity (AZCC for corporations/LLCs)\n- [ ] Obtain EIN (IRS)\n- [ ] Open business bank account (use banking-checklist.md)\n- [ ] Set up bookkeeping categories\n\n## Phase 3 — Arizona Tax & Licensing\n- [ ] Determine if you need an AZ Transaction Privilege Tax (TPT) license (sales/use tax; some services)\n- [ ] Set up withholding/unemployment accounts if hiring\n- [ ] Check city licensing requirements for ${ctx.city} (home occupation, signage, etc.)\n\n## Phase 4 — Operations\n- [ ] Define services/products + pricing\n- [ ] Build intake and scope templates (client-intake-template.txt)\n- [ ] Create invoice flow (invoice-template.csv)\n- [ ] Define policy basics (policy-starters.md)\n\n## Phase 5 — Launch\n- [ ] Website + Google Business Profile\n- [ ] Basic analytics + conversion form\n- [ ] Launch announcement + outreach plan\n\n### Notes\n- Keep copies of formation docs, EIN letter, licenses, and bank agreements in a secure folder.\n- If hiring, set up payroll + workers comp early.\n\nGenerated: ${ctx.generatedAt}\n`,

    "banking-checklist.md": (ctx) => `# Banking Checklist — ${ctx.businessName}\n\n## What to bring to the bank\n- [ ] Formation documents (AZCC filing confirmation / stamped articles)\n- [ ] EIN confirmation\n- [ ] Photo ID for signers\n- [ ] Operating agreement/bylaws (often requested)\n- [ ] Business address + contact info\n\n## Accounts to consider\n- [ ] Checking\n- [ ] Savings (tax reserves)\n- [ ] Merchant processing / card payments\n- [ ] Line of credit (optional)\n\n## Setup steps\n- [ ] Decide who has signing authority\n- [ ] Set up debit cards and limits\n- [ ] Enable online banking + 2FA\n- [ ] Create a “tax reserve” transfer rule (weekly or per deposit)\n- [ ] Link bookkeeping tool / accounting system\n\n## Controls (recommended)\n- [ ] Separate personal and business finances (no mixing)\n- [ ] Approvals for payments over a threshold\n- [ ] Monthly reconciliation\n\nGenerated: ${ctx.generatedAt}\n`,

    "ops-foundation.md": (ctx) => `# Operations Foundation — ${ctx.businessName}\n\nThis is a practical starting framework for day-1 operations. Customize aggressively.\n\n## 1) Core decisions\n- Mission: ____________________________\n- Primary offer: _______________________\n- Target customer: _____________________\n- Promise / outcome: __________________\n\n## 2) Default workflow\n1. Lead arrives → respond within 1 business day\n2. Discovery call → fill client-intake-template.txt\n3. Proposal/scope → confirm price + timeline\n4. Invoice & deposit → start work only after payment\n5. Delivery → sign-off + next steps\n6. Aftercare → ask for testimonial + referrals\n\n## 3) Minimum weekly rhythm\n- Monday: pipeline + priorities\n- Midweek: delivery blocks\n- Friday: finance review + reconciliation\n\n## 4) Hiring note\nHiring employees: ${ctx.hireEmployees ? "YES — plan policies early (payroll, I-9, W-4, handbook stubs)." : "NO — keep contractor templates handy and document processes."}\n\n## 5) Record-keeping\n- Store contracts, invoices, receipts, and licenses in one secure folder\n- Keep a single source-of-truth tracker for projects\n\nGenerated: ${ctx.generatedAt}\n`,

    "website-launch-checklist.md": (ctx) => `# Website Launch Checklist — ${ctx.businessName}\n\n## Essentials\n- [ ] Domain acquired\n- [ ] Business email set up\n- [ ] Homepage with clear offer + CTA\n- [ ] Contact / booking form\n- [ ] Mobile responsive\n- [ ] Basic SEO (title/description, headings, keywords)\n\n## Trust & conversion\n- [ ] About section (why you)\n- [ ] Testimonials (even 1-3)\n- [ ] Pricing or “starting at” guidance\n- [ ] Policies (privacy/terms starter bullets)\n\n## Local presence (AZ)\n- [ ] Google Business Profile\n- [ ] Consistent NAP (name/address/phone)\n- [ ] Local keywords: ${ctx.city} + service\n\n## Launch\n- [ ] Submit sitemap\n- [ ] Add analytics\n- [ ] Test all links + forms\n- [ ] Announce on socials + email\n\nGenerated: ${ctx.generatedAt}\n`,

    "client-intake-template.txt": (ctx) => `CLIENT INTAKE — ${ctx.businessName}\n\nDate: ____________\nClient Name: __________________________\nCompany: ______________________________\nPhone/Email: __________________________\n\n1) What outcome are you trying to achieve?\n   - __________________________________\n\n2) What’s the deadline / key dates?\n   - __________________________________\n\n3) What’s the current situation?\n   - __________________________________\n\n4) Scope (what’s included / excluded)\n   Included:\n   - __________________________________\n   Excluded:\n   - __________________________________\n\n5) Budget range (if any)\n   - __________________________________\n\n6) Decision makers\n   - __________________________________\n\n7) Risks / constraints\n   - __________________________________\n\nNext Step: _____________________________\n`,

    "invoice-template.csv": (ctx) => `InvoiceNumber,InvoiceDate,ClientName,ClientEmail,ServiceDescription,Qty,UnitPrice,Subtotal,TaxRate,TaxAmount,Total,DueDate,Status,Notes\nINV-0001,${ctx.today},,,"Initial Deposit / Scope",1,0,0,0,0,0,,Draft,\n`,

    "policy-starters.md": (ctx) => `# Policy Starters — Privacy / Terms (bullets)\n\nThese are starter bullets to accelerate drafting. Have a qualified professional review.\n\n## Privacy (starter bullets)\n- What you collect (name, email, phone, billing, technical logs)\n- Why you collect it (service delivery, support, billing, analytics)\n- How you store it (reasonable security measures; retention practices)\n- Sharing (processors like email, payments; no selling of personal data by default)\n- Cookies / analytics (what tools, opt-out language)\n- User rights (access, deletion requests, contact)\n- Children’s privacy (if not intended for minors)\n\n## Terms (starter bullets)\n- Scope of services and delivery expectations\n- Payment terms (deposit, due dates, late fees)\n- Intellectual property (who owns what, license terms)\n- Acceptable use (no unlawful usage)\n- Disclaimers (no guaranteed outcomes)\n- Limitation of liability\n- Termination and refunds\n- Dispute resolution & governing law (Arizona)\n\nGenerated for: ${ctx.businessName} • ${ctx.city}, AZ\nGenerated: ${ctx.generatedAt}\n`
  };

  function safeStr(v, fallback="") {
    return (v === undefined || v === null) ? fallback : String(v);
  }

  function normalizeInputs(inputs) {
    const d = new Date();
    const today = d.toISOString().slice(0,10);
    return {
      businessName: safeStr(inputs.businessName).trim() || "Unnamed Business",
      city: safeStr(inputs.city).trim() || "Phoenix",
      industry: safeStr(inputs.industry).trim() || "General",
      ownersCount: Number(inputs.ownersCount || 1),
      hireEmployees: !!inputs.hireEmployees,
      generatedAt: new Date().toISOString(),
      today
    };
  }

  async function buildZipPack(inputs) {
    if (typeof JSZip === "undefined") throw new Error("JSZip is not loaded.");

    const ctx = normalizeInputs(inputs);
    const zip = new JSZip();

    const filenames = Object.keys(DOCS);
    for (const name of filenames) {
      const content = DOCS[name](ctx);
      zip.file(name, content);
    }

    const blob = await zip.generateAsync({ type: "blob" });
    return {
      blob,
      ctx,
      filenames
    };
  }

  window.KAIXU_ZIP = {
    buildZipPack,
    normalizeInputs
  };
})();
