const KAIXU_PROVIDER = "Skyes Over London";
const KAIXU_INTELLIGENCE = "kAIxU";

const KAIXU_TOOLS = [
  {
    id: "01-valuation",
    number: "01",
    name: "Valuation Forge",
    tagline: "Enterprise valuation certificate + scoring rubric + financing schedule.",
    fields: [
      { key: "subject_type", label: "Subject type", type: "select", options: ["Website", "App", "Brand", "Platform", "Service Offering"], required: true, default: "Website" },
      { key: "subject_name", label: "Subject name", type: "text", required: true, placeholder: "NorthStar Office & Accounting" },
      { key: "url", label: "URL (optional)", type: "url", required: false, placeholder: "https://example.com" },
      { key: "notes", label: "Notes / features / differentiators", type: "textarea", required: false, placeholder: "What makes it valuable? (UX, workflows, compliance, automation, market niche...)" },
      { key: "target_customer", label: "Target customer", type: "text", required: false, placeholder: "Local businesses / enterprise / agencies / SMB" },
      { key: "term_months", label: "Financing term months", type: "select", options: ["6","12","18","24"], required: true, default: "12" },
      { key: "deposit_percent", label: "Deposit %", type: "select", options: ["10","20","30","40","50"], required: true, default: "30" }
    ],
    prompt_goal: "Produce a valuation certificate with a single valuation number, a conservative range, scoring rubric, and a financing schedule."
  },

  {
    id: "02-trust-pack",
    number: "02",
    name: "Trust Pack Generator",
    tagline: "Security overview binder (controls matrix + incident response + retention).",
    fields: [
      { key: "system_name", label: "System / product name", type: "text", required: true, placeholder: "kAIxU Gateway" },
      { key: "data_types", label: "Data types handled", type: "textarea", required: true, placeholder: "PII? Billing? Logs? Uploaded files? Messages?" },
      { key: "auth", label: "Auth methods", type: "textarea", required: true, placeholder: "Email/password, SSO, magic links, MFA, RBAC..." },
      { key: "logging", label: "Logging & audit", type: "textarea", required: false, placeholder: "What’s logged? Retention? Tamper protection?" },
      { key: "backups", label: "Backups & recovery", type: "textarea", required: false, placeholder: "Backup schedule, restore testing, RPO/RTO targets..." }
    ],
    prompt_goal: "Generate a client-facing trust pack with controls matrix, risks, and operational plans."
  },

  {
    id: "03-contract-kit",
    number: "03",
    name: "Contract Kit Builder",
    tagline: "Client services agreement + SOW + signature blocks (binder style).",
    fields: [
      { key: "client_name", label: "Client legal name", type: "text", required: true, placeholder: "Client LLC" },
      { key: "client_contact", label: "Client contact", type: "text", required: false, placeholder: "Name, email, phone" },
      { key: "scope", label: "Scope of work", type: "textarea", required: true, placeholder: "Deliverables, pages, features, integrations, hosting..." },
      { key: "timeline", label: "Timeline", type: "textarea", required: false, placeholder: "Milestones + dates" },
      { key: "payment_terms", label: "Payment terms", type: "textarea", required: true, placeholder: "Deposit, milestones, monthly, late fees, payment methods..." }
    ],
    prompt_goal: "Draft a clean contract binder with clauses and exhibits (not legal advice)."
  },

  {
    id: "04-proposal",
    number: "04",
    name: "Proposal Engine",
    tagline: "Sales proposal binder (tiers, timeline, outcomes, objections).",
    fields: [
      { key: "prospect_name", label: "Prospect name", type: "text", required: true, placeholder: "Prospect Company" },
      { key: "industry", label: "Industry", type: "text", required: false, placeholder: "Accounting / Logistics / Retail / Sports..." },
      { key: "pain_points", label: "Pain points", type: "textarea", required: true, placeholder: "What hurts today? What’s broken? What’s expensive?" },
      { key: "packages", label: "Package tiers", type: "textarea", required: true, placeholder: "Tier 1 / Tier 2 / Tier 3 — include deliverables & price logic" },
      { key: "timeline", label: "Timeline expectation", type: "textarea", required: false, placeholder: "2 weeks, 30 days, phased rollout..." }
    ],
    prompt_goal: "Produce a persuasive proposal binder with clear tiers and execution plan."
  },

  {
    id: "05-invoice",
    number: "05",
    name: "Invoice + Receipt Vault",
    tagline: "Branded invoice + receipt + statement pack with IDs + QR.",
    fields: [
      { key: "client_name", label: "Client name", type: "text", required: true, placeholder: "Client LLC" },
      { key: "invoice_number", label: "Invoice number", type: "text", required: true, placeholder: "INV-00021" },
      { key: "line_items", label: "Line items", type: "textarea", required: true, placeholder: "One per line: Description | Qty | Unit Price" },
      { key: "tax_percent", label: "Tax % (optional)", type: "number", required: false, placeholder: "0" },
      { key: "notes", label: "Notes / payment instructions", type: "textarea", required: false, placeholder: "Due date, accepted payment methods, late fee policy..." }
    ],
    prompt_goal: "Generate an invoice/receipt narrative plus a clean line-item table and totals."
  },

  {
    id: "06-commission",
    number: "06",
    name: "Commission Statement Generator",
    tagline: "Monthly payout statement + ledger appendix + authorization block.",
    fields: [
      { key: "agent_name", label: "Agent / partner name", type: "text", required: true, placeholder: "AE Name" },
      { key: "period", label: "Statement period", type: "text", required: true, placeholder: "Feb 2026" },
      { key: "deals", label: "Deals ledger", type: "textarea", required: true, placeholder: "One per line: Deal | Amount | Split% | Notes" },
      { key: "payout_date", label: "Payout date", type: "text", required: false, placeholder: "2026-03-05" }
    ],
    prompt_goal: "Compute/describe payout statement with clear totals and deal-by-deal breakdown."
  },

  {
    id: "07-lead",
    number: "07",
    name: "Lead Intelligence Report",
    tagline: "Prospect audit + prioritized fixes + ROI narrative (sales weapon).",
    fields: [
      { key: "business_name", label: "Business name", type: "text", required: true, placeholder: "Business Name" },
      { key: "website", label: "Website", type: "url", required: false, placeholder: "https://business.com" },
      { key: "category", label: "Category", type: "text", required: true, placeholder: "Barbershop / Logistics / Accounting..." },
      { key: "issues_seen", label: "Issues observed", type: "textarea", required: true, placeholder: "Slow site, no booking, no Google profile, weak reviews..." },
      { key: "goals", label: "Business goals", type: "textarea", required: false, placeholder: "More calls, bookings, referrals, hires..." }
    ],
    prompt_goal: "Produce a structured audit report with a prioritized action plan and outcome narrative."
  },

  {
    id: "08-brandbook",
    number: "08",
    name: "Brand Identity Packet Builder",
    tagline: "Brand book binder (logo rules, typography scale, voice, motion).",
    fields: [
      { key: "brand_name", label: "Brand name", type: "text", required: true, placeholder: "Brand" },
      { key: "colors", label: "Color palette", type: "textarea", required: true, placeholder: "Primary/secondary colors + hex values if known" },
      { key: "typography", label: "Typography", type: "textarea", required: false, placeholder: "Font choices, scale rules, spacing ratios..." },
      { key: "voice", label: "Brand voice", type: "textarea", required: true, placeholder: "Tone rules, taboo words, style discipline..." }
    ],
    prompt_goal: "Generate a clean brand book with enforceable rules and examples."
  },

  {
    id: "09-onboarding",
    number: "09",
    name: "Client Onboarding Binder",
    tagline: "Kickoff pack + access checklist + milestones + expectations.",
    fields: [
      { key: "client_name", label: "Client name", type: "text", required: true, placeholder: "Client LLC" },
      { key: "project_name", label: "Project name", type: "text", required: true, placeholder: "Website Build" },
      { key: "start_date", label: "Start date", type: "text", required: false, placeholder: "2026-02-26" },
      { key: "contacts", label: "Contacts", type: "textarea", required: false, placeholder: "Client + SOL contacts" },
      { key: "deliverables", label: "Deliverables", type: "textarea", required: true, placeholder: "What’s being delivered and in what phases" }
    ],
    prompt_goal: "Create a professional onboarding binder with checklists and responsibilities."
  },

  {
    id: "10-audit",
    number: "10",
    name: "Compliance Receipt Export",
    tagline: "Audit snapshot PDF (events, integrity, attestation page).",
    fields: [
      { key: "system_name", label: "System name", type: "text", required: true, placeholder: "System" },
      { key: "range", label: "Date range", type: "text", required: true, placeholder: "2026-02-01 to 2026-02-26" },
      { key: "events", label: "Event log summary", type: "textarea", required: true, placeholder: "Summarize events or paste key entries" },
      { key: "notes", label: "Notes (optional)", type: "textarea", required: false, placeholder: "Anomalies, exceptions, follow-ups..." }
    ],
    prompt_goal: "Generate an audit snapshot narrative and structured summary table."
  },

  {
    id: "11-incident",
    number: "11",
    name: "Incident Report Writer",
    tagline: "Postmortem binder (timeline, impact, root cause, CAPA).",
    fields: [
      { key: "incident_title", label: "Incident title", type: "text", required: true, placeholder: "Service Degradation" },
      { key: "start_time", label: "Start time", type: "text", required: true, placeholder: "2026-02-25 14:10" },
      { key: "end_time", label: "End time", type: "text", required: false, placeholder: "2026-02-25 15:05" },
      { key: "impact", label: "Impact", type: "textarea", required: true, placeholder: "Who was affected? What broke? Severity?" },
      { key: "timeline", label: "Timeline (bullets)", type: "textarea", required: true, placeholder: "Time — action — outcome" },
      { key: "root_cause", label: "Root cause", type: "textarea", required: true, placeholder: "The actual cause (not symptoms)" },
      { key: "fixes", label: "Fixes + follow-ups", type: "textarea", required: true, placeholder: "Immediate fixes + preventive actions + owners" }
    ],
    prompt_goal: "Create a crisp postmortem with accountability and prevention plan."
  },

  {
    id: "12-execbrief",
    number: "12",
    name: "Executive Brief Generator",
    tagline: "One-page decision brief + appendix (metrics, risks, next steps).",
    fields: [
      { key: "topic", label: "Topic", type: "text", required: true, placeholder: "Monthly performance" },
      { key: "kpis", label: "KPIs", type: "textarea", required: true, placeholder: "Metric | Value | Note" },
      { key: "wins", label: "Wins", type: "textarea", required: false, placeholder: "Top wins" },
      { key: "risks", label: "Risks", type: "textarea", required: false, placeholder: "Risks + mitigation" },
      { key: "next_steps", label: "Next steps", type: "textarea", required: true, placeholder: "What happens next" }
    ],
    prompt_goal: "Produce a tight executive brief with a decision-ready structure."
  },

  {
    id: "13-offer",
    number: "13",
    name: "Pricing & Financing Offer Letter",
    tagline: "Formal offer letter + schedule tables + signature blocks.",
    fields: [
      { key: "client_name", label: "Client name", type: "text", required: true, placeholder: "Client LLC" },
      { key: "offer_title", label: "Offer title", type: "text", required: true, placeholder: "Platform Build Offer" },
      { key: "valuation", label: "Valuation / price (USD)", type: "number", required: true, placeholder: "75000" },
      { key: "deposit_percent", label: "Deposit %", type: "select", options: ["10","20","30","40","50"], required: true, default: "30" },
      { key: "term_months", label: "Term months", type: "select", options: ["6","12","18","24"], required: true, default: "12" },
      { key: "scope_summary", label: "Scope summary", type: "textarea", required: true, placeholder: "What’s included + what’s not" }
    ],
    prompt_goal: "Generate a professional offer letter with payment schedule, scope and assumptions."
  },

  {
    id: "14-catalog",
    number: "14",
    name: "Service Catalog Publisher",
    tagline: "Tier matrix + packaged offerings (always-current product book).",
    fields: [
      { key: "brand", label: "Catalog brand name", type: "text", required: true, placeholder: "Skyes Over London" },
      { key: "industries", label: "Industries served", type: "textarea", required: true, placeholder: "List industries" },
      { key: "tiers", label: "Tiers / packages", type: "textarea", required: true, placeholder: "Tier name | Price logic | Deliverables" },
      { key: "sla", label: "SLA notes", type: "textarea", required: false, placeholder: "Response times, support windows, escalation..." }
    ],
    prompt_goal: "Create a catalog with clean tier language and comparison matrix."
  },

  {
    id: "15-certificate",
    number: "15",
    name: "Certificate Factory",
    tagline: "Printable certificate with ID + verification QR.",
    fields: [
      { key: "recipient", label: "Recipient name", type: "text", required: true, placeholder: "Name" },
      { key: "certificate_title", label: "Certificate title", type: "text", required: true, placeholder: "Verification Certificate" },
      { key: "tier", label: "Tier / level", type: "text", required: false, placeholder: "Gold / Platinum / Verified" },
      { key: "effective_date", label: "Effective date", type: "text", required: false, placeholder: "2026-02-26" },
      { key: "notes", label: "Notes (optional)", type: "textarea", required: false, placeholder: "Conditions, scope, validity period..." }
    ],
    prompt_goal: "Generate certificate wording, credential description, and verification metadata."
  },

  {
    id: "16-policy",
    number: "16",
    name: "Policy Pack Generator",
    tagline: "Policy binder (privacy, terms, acceptable use, refunds).",
    fields: [
      { key: "company", label: "Company / brand", type: "text", required: true, placeholder: "Skyes Over London" },
      { key: "site", label: "Website / app name", type: "text", required: true, placeholder: "App Name" },
      { key: "data_collected", label: "Data collected", type: "textarea", required: true, placeholder: "Emails, names, payment metadata, logs..." },
      { key: "refunds", label: "Refund policy rules", type: "textarea", required: false, placeholder: "When refunds apply, when they don’t..." },
      { key: "usage_rules", label: "Usage rules / acceptable use", type: "textarea", required: false, placeholder: "Restrictions, abuse, prohibited content..." }
    ],
    prompt_goal: "Generate a consistent policy pack (not legal advice)."
  },

  {
    id: "17-handoff",
    number: "17",
    name: "Website Build Handoff Pack",
    tagline: "Handoff binder (credentials checklist, sitemap, renewals, maintenance).",
    fields: [
      { key: "client", label: "Client", type: "text", required: true, placeholder: "Client LLC" },
      { key: "site_url", label: "Site URL", type: "url", required: false, placeholder: "https://clientsite.com" },
      { key: "features", label: "Features delivered", type: "textarea", required: true, placeholder: "Forms, CRM, analytics, SEO, hosting..." },
      { key: "credentials", label: "Credentials checklist", type: "textarea", required: false, placeholder: "Domains, hosting, email, analytics, admin logins..." },
      { key: "renewals", label: "Renewals & schedule", type: "textarea", required: false, placeholder: "Domains, SSL, subscriptions, maintenance cadence..." }
    ],
    prompt_goal: "Create a clean handoff binder that a client can follow without confusion."
  },

  {
    id: "18-beforeafter",
    number: "18",
    name: "Before/After Transformation Report",
    tagline: "Contrast panels + outcomes narrative + next-phase roadmap.",
    fields: [
      { key: "client", label: "Client / brand", type: "text", required: true, placeholder: "Client" },
      { key: "before", label: "Before state", type: "textarea", required: true, placeholder: "Problems, gaps, metrics, chaos..." },
      { key: "after", label: "After state", type: "textarea", required: true, placeholder: "Fixes delivered, outcomes, metrics..." },
      { key: "proof", label: "Proof / evidence (optional)", type: "textarea", required: false, placeholder: "Screenshots list, links, notes..." },
      { key: "next_phase", label: "Next phase roadmap", type: "textarea", required: false, placeholder: "Upsell plan / roadmap" }
    ],
    prompt_goal: "Produce a sales-ready transformation report with quantified impact and roadmap."
  }
];
