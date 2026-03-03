/* ══════════════════════════════════════════════
   Growth Platform JS
   - Blog rendering
   - Portal status dashboard
   - Gated Vault + Admin console helpers
   
   Designed to work even if Functions are not deployed:
   - Public pages render “read-only mode” with friendly messaging.
   ══════════════════════════════════════════════ */

(function(){
  const $ = (sel, root=document) => root.querySelector(sel);
  const $$ = (sel, root=document) => Array.from(root.querySelectorAll(sel));

  const state = {
    apiBase: '/.netlify/functions',
    identityReady: false,
    user: null,
  };

  const staticPosts = [
    { slug: 'the-net-works-phoenix-physical-ai-corridor', title: 'Phoenix’s Physical AI Corridor: Chips, Power, and Edge Intelligence', excerpt: 'Semiconductors and power delivery are the skeleton of modern AI systems, and Phoenix is becoming a strategic node.', published_at: '2026-02-28T00:00:00.000Z', tags: ["THE NET WORKS", "Phoenix", "AI Infrastructure"], staticUrl: 'THE NET WORKS/FEATURING/phoenix-s-physical-ai-corridor-chips-power-and-edge-intelligence.html' },
    { slug: 'the-net-works-asu-principled-ai-push', title: 'ASU’s Principled AI Push: When a University Treats GenAI Like Infrastructure', excerpt: 'A practical look at talent pipelines and institutional AI readiness in Phoenix.', published_at: '2026-02-27T00:00:00.000Z', tags: ["THE NET WORKS", "Phoenix", "Education"], staticUrl: 'THE NET WORKS/FEATURING/asu-s-principled-ai-push-when-a-university-treats-genai-like-infrastructure.html' },
    { slug: 'the-net-works-wavex-aca-venture-studio', title: 'WaveX and the Arizona Commerce Authority: A New Kind of AI Venture Studio in Phoenix', excerpt: 'How venture studio mechanics and local infrastructure are combining for applied AI commercialization.', published_at: '2026-02-26T00:00:00.000Z', tags: ["THE NET WORKS", "Phoenix", "Ecosystem"], staticUrl: 'THE NET WORKS/FEATURING/wavex-and-the-arizona-commerce-authority-a-new-kind-of-ai-venture-studio-in-phoenix.html' },
    { slug: 'the-net-works-healthcare-ai-metro-phoenix', title: 'Healthcare AI in Metro Phoenix: Fast Wins, Real Patients, No Camera Drama', excerpt: 'Real deployment patterns for patient care and clinical coordination without surveillance-heavy theater.', published_at: '2026-02-25T00:00:00.000Z', tags: ["THE NET WORKS", "Healthcare", "Phoenix"], staticUrl: 'THE NET WORKS/FEATURING/healthcare-ai-in-metro-phoenix-fast-wins-real-patients-no-camera-drama.html' },
    { slug: 'the-net-works-autonomy-honeywell-phoenix', title: 'Autonomy in the Desert: Honeywell’s Phoenix Tests and the Reality of AI in the Air', excerpt: 'Field-tested autonomy is built on systems discipline, not hype cycles.', published_at: '2026-02-24T00:00:00.000Z', tags: ["THE NET WORKS", "Autonomy", "Aerospace"], staticUrl: 'THE NET WORKS/FEATURING/autonomy-in-the-desert-honeywell-s-phoenix-tests-and-the-reality-of-ai-in-the-air.html' },
    { slug: 'the-net-works-ai-that-doesnt-spy', title: 'AI That Doesn’t Spy: Phoenix Eldercare and Radar-Based Fall Risk Signals', excerpt: 'Privacy-preserving sensing and care-oriented signal design for real-world eldercare environments.', published_at: '2026-02-22T00:00:00.000Z', tags: ["THE NET WORKS", "Healthcare", "Applied AI"], staticUrl: 'THE NET WORKS/FEATURING/ai-that-doesn-t-spy-phoenix-eldercare-and-radar-based-fall-risk-signals.html' },
    { slug: 'the-net-works-microchip-embedded-ml', title: 'Microchip in Chandler: Embedded ML as the Quiet Workhorse of the Valley', excerpt: 'Small, deterministic models at the edge remain central to practical AI deployment.', published_at: '2026-02-20T00:00:00.000Z', tags: ["THE NET WORKS", "Semiconductors", "Embedded ML"], staticUrl: 'THE NET WORKS/FEATURING/microchip-in-chandler-embedded-ml-as-the-quiet-workhorse-of-the-valley.html' },
    { slug: 'the-net-works-onsemi-power-bottleneck', title: 'onsemi in Scottsdale: Power Electronics as AI’s Hidden Bottleneck', excerpt: 'Why energy conversion, heat, and power-density constraints shape AI throughput as much as model architecture.', published_at: '2026-02-18T00:00:00.000Z', tags: ["THE NET WORKS", "Semiconductors", "Power"], staticUrl: 'THE NET WORKS/FEATURING/onsemi-in-scottsdale-power-electronics-as-ai-s-hidden-bottleneck.html' },
    { slug: 'the-net-works-nxp-physical-ai', title: 'NXP and Physical AI: The Industrial Version of Intelligence Phoenix Businesses Actually Use', excerpt: 'Industrial AI succeeds where sensing, controls, and edge inference meet operational constraints.', published_at: '2026-02-16T00:00:00.000Z', tags: ["THE NET WORKS", "Industrial AI", "Phoenix"], staticUrl: 'THE NET WORKS/FEATURING/nxp-and-physical-ai-the-industrial-version-of-intelligence-phoenix-businesses-actually-use.html' },
    { slug: 'the-net-works-tsmc-local-supply-chain', title: 'TSMC Arizona and the Local AI Supply Chain: Phoenix as a Strategic Node', excerpt: 'Leading-edge fabrication changes the economics and geography of AI system development.', published_at: '2026-02-14T00:00:00.000Z', tags: ["THE NET WORKS", "TSMC", "Semiconductors"], staticUrl: 'THE NET WORKS/FEATURING/tsmc-arizona-and-the-local-ai-supply-chain-phoenix-as-a-strategic-node.html' },
    { slug: 'the-net-works-tgen-applied-ai-biotech', title: 'TGen in Downtown Phoenix: Data-Heavy Biotech and the Next Wave of Applied AI', excerpt: 'Biotech + AI in Phoenix shows how dense data systems convert into deployable intelligence.', published_at: '2026-02-11T00:00:00.000Z', tags: ["THE NET WORKS", "Biotech", "Applied AI"], staticUrl: 'THE NET WORKS/FEATURING/tgen-in-downtown-phoenix-data-heavy-biotech-and-the-next-wave-of-applied-ai.html' },
    { slug: 'the-net-works-workforce-ai-east-valley', title: 'Workforce AI in the East Valley: Intel + Community Colleges as a Talent Multiplier', excerpt: 'Long-term AI capacity depends on operator training pipelines, not just capital deployment.', published_at: '2026-02-08T00:00:00.000Z', tags: ["THE NET WORKS", "Workforce", "Phoenix"], staticUrl: 'THE NET WORKS/FEATURING/workforce-ai-in-the-east-valley-intel-community-colleges-as-a-talent-multiplier.html' },
    { slug: 'the-net-works-phoenix-ai-index', title: 'Phoenix AI Index: The Companies, Institutions, and Infrastructure That Actually Matter', excerpt: 'A systems map of the organizations, infrastructure, and execution realities shaping Phoenix AI.', published_at: '2026-02-04T00:00:00.000Z', tags: ["THE NET WORKS", "Phoenix", "AI Landscape"], staticUrl: 'THE NET WORKS/FEATURING/phoenix-ai-index-the-companies-institutions-and-infrastructure-that-actually-matter.html' },
    { slug: 'web-development-phoenix-az-apex-operator-playbook', title: 'Web Development in Phoenix, AZ: The APEX Operator Playbook for Fast Sites, Higher Rankings, and Real Leads (2026)', excerpt: 'A dense, operator-grade guide to web development in Phoenix, AZ. Learn how to build fast, conversion-ready websites with local SEO baked in: architecture, performance, content strategy, Map Pack suppo', published_at: '2026-02-20T00:00:00.000Z', tags: ["web development Phoenix AZ", "web design Phoenix", "Phoenix SEO"], staticUrl: 'Blogs/web-development-phoenix-az-apex-operator-playbook.html' },
    { slug: 'skyedocx', title: 'SkyeDocx: The Document Platform Built for Real Operators', excerpt: 'SkyeDocx isn\'t a template library. It\'s a document infrastructure layer — contracts, proposals, SOPs, and operator records built to survive real-world execution. Inside the SOLEnterprises ecosystem.', published_at: '2026-01-22T00:00:00.000Z', tags: ["SkyeDocx", "Documents", "Operator"], staticUrl: 'Blogs/SkyeDocx.html' },
    { slug: 'web-development-in-phoenix-az', title: 'Web Development in Phoenix, AZ | Modern Websites, SEO, Speed & Conversions (2026 Guide)', excerpt: 'Full guide to modern web development in Phoenix, Arizona: UX, SEO, performance, accessibility, mobile-first design, Netlify hosting, analytics, and conversion-focused builds for local businesses.', published_at: '2026-01-16T00:00:00.000Z', tags: ["web development Phoenix AZ", "Phoenix web design", "website developer Phoenix"], staticUrl: 'Blogs/Web Development in Phoenix, AZ.html' },
    { slug: 'skaixu-blog-13-the-operator-s-ide-designing-for-pressure-not-demos', title: 'The Operator’s IDE: Designing for Pressure, Not Demos | SkAIxu IDE Blog', excerpt: 'Operator-grade tools assume deadlines, interruptions, and imperfect conditions—and still stay reliable. Launch the live SkAIxu IDE at https://skaixuidepro.netlify.app.', published_at: '2026-01-07T00:00:00.000Z', tags: ["SkAIxu", "AI", "IDE"], staticUrl: 'Blogs/Skaixu/skaixu_blog_13_the-operator-s-ide-designing-for-pressure-not-demos.html' },
    { slug: 'skaixu-blog-12-pattern-libraries-patch-recipes-scale-changes-without-drift', title: 'Pattern Libraries + Patch Recipes: Scale Changes Without Drift | SkAIxu IDE Blog', excerpt: 'Build a patch recipe library so recurring changes become predictable, fast, and consistent across teams. Launch the live SkAIxu IDE at https://skaixuidepro.netlify.app.', published_at: '2025-12-29T00:00:00.000Z', tags: ["SkAIxu", "AI", "IDE"], staticUrl: 'Blogs/Skaixu/skaixu_blog_12_pattern-libraries-patch-recipes-scale-changes-without-drift.html' },
    { slug: 'skaixu-blog-11-why-production-endpoints-must-be-closed-by-default', title: 'Why Production Endpoints Must Be Closed by Default | SkAIxu IDE Blog', excerpt: 'Open endpoints turn into open incidents. Here’s the minimal posture for safety: closed by default, gated access. Launch the live SkAIxu IDE at https://skaixuidepro.netlify.app.', published_at: '2025-12-20T00:00:00.000Z', tags: ["SkAIxu", "AI", "IDE"], staticUrl: 'Blogs/Skaixu/skaixu_blog_11_why-production-endpoints-must-be-closed-by-default.html' },
    { slug: 'skaixu-blog-10-auditability-without-enterprise-overhead', title: 'Auditability Without Enterprise Overhead | SkAIxu IDE Blog', excerpt: 'You don’t need a heavyweight platform to be accountable—just structured edits, proof, and lightweight logs. Launch the live SkAIxu IDE at https://skaixuidepro.netlify.app.', published_at: '2025-12-11T00:00:00.000Z', tags: ["SkAIxu", "AI", "IDE"], staticUrl: 'Blogs/Skaixu/skaixu_blog_10_auditability-without-enterprise-overhead.html' },
    { slug: 'skaixu-blog-09-agency-workflow-faster-client-builds-without-losing-control', title: 'Agency Workflow: Faster Client Builds Without Losing Control | SkAIxu IDE Blog', excerpt: 'Deliver faster for clients while keeping every edit scoped, reviewable, and repeatable across projects. Launch the live SkAIxu IDE at https://skaixuidepro.netlify.app.', published_at: '2025-12-02T00:00:00.000Z', tags: ["SkAIxu", "AI", "IDE"], staticUrl: 'Blogs/Skaixu/skaixu_blog_09_agency-workflow-faster-client-builds-without-losing-control.html' },
    { slug: 'skaixu-blog-08-element-level-refactors-without-breaking-layout', title: 'Element-Level Refactors Without Breaking Layout | SkAIxu IDE Blog', excerpt: 'Targeted HTML/CSS surgery beats global rewrites. Here’s how to refactor one component without collateral damage. Launch the live SkAIxu IDE at https://skaixuidepro.netlify.app.', published_at: '2025-11-23T00:00:00.000Z', tags: ["SkAIxu", "AI", "IDE"], staticUrl: 'Blogs/Skaixu/skaixu_blog_08_element-level-refactors-without-breaking-layout.html' },
    { slug: 'skaixu-blog-07-from-prompt-chaos-to-engineering-discipline-a-practical-loop', title: 'From Prompt Chaos to Engineering Discipline: A Practical Loop | SkAIxu IDE Blog', excerpt: 'Replace \'prompt and pray\' with a repeatable loop: target → patch → apply → verify → repeat. Launch the live SkAIxu IDE at https://skaixuidepro.netlify.app.', published_at: '2025-11-14T00:00:00.000Z', tags: ["SkAIxu", "AI", "IDE"], staticUrl: 'Blogs/Skaixu/skaixu_blog_07_from-prompt-chaos-to-engineering-discipline-a-practical-loop.html' },
    { slug: 'skaixu-blog-06-undo-redo-as-a-safety-rail-reliability-for-rapid-iteration', title: 'Undo/Redo as a Safety Rail: Reliability for Rapid Iteration | SkAIxu IDE Blog', excerpt: 'Undo/redo isn’t a convenience feature. It’s a reliability system when AI edits are involved. Launch the live SkAIxu IDE at https://skaixuidepro.netlify.app.', published_at: '2025-11-06T00:00:00.000Z', tags: ["SkAIxu", "AI", "IDE"], staticUrl: 'Blogs/Skaixu/skaixu_blog_06_undo-redo-as-a-safety-rail-reliability-for-rapid-iteration.html' },
    { slug: 'skaixu-blog-05-governance-first-ai-routing-model-access-designed-like-security', title: 'Governance-First AI Routing: Model Access Designed Like Security | SkAIxu IDE Blog', excerpt: 'Routing AI through policy isn’t bureaucracy—it’s how you keep production sane, auditable, and safe. Launch the live SkAIxu IDE at https://skaixuidepro.netlify.app.', published_at: '2025-10-28T00:00:00.000Z', tags: ["SkAIxu", "AI", "IDE"], staticUrl: 'Blogs/Skaixu/skaixu_blog_05_governance-first-ai-routing-model-access-designed-like-security.html' },
    { slug: 'skaixu-blog-04-pwa-install-portable-workspace-your-ide-in-one-tap', title: 'PWA Install + Portable Workspace: Your IDE in One Tap | SkAIxu IDE Blog', excerpt: 'Install SkAIxu IDE like an app, keep a consistent workspace identity, and move faster with less friction. Launch the live SkAIxu IDE at https://skaixuidepro.netlify.app.', published_at: '2025-10-19T00:00:00.000Z', tags: ["SkAIxu", "AI", "IDE"], staticUrl: 'Blogs/Skaixu/skaixu_blog_04_pwa-install-portable-workspace-your-ide-in-one-tap.html' },
    { slug: 'skaixu-blog-03-offline-first-ide-local-persistence-that-survives-real-life', title: 'Offline-First IDE: Local Persistence That Survives Real Life | SkAIxu IDE Blog', excerpt: 'Wi‑Fi drops. Browsers crash. Operators keep moving. Offline-first persistence makes iteration reliable. Launch the live SkAIxu IDE at https://skaixuidepro.netlify.app.', published_at: '2025-10-10T00:00:00.000Z', tags: ["SkAIxu", "AI", "IDE"], staticUrl: 'Blogs/Skaixu/skaixu_blog_03_offline-first-ide-local-persistence-that-survives-real-life.html' },
    { slug: 'skaixu-blog-02-preview-to-patch-targeting-click-to-edit-that-stops-ambiguity', title: 'Preview-to-Patch Targeting: Click-to-Edit That Stops Ambiguity | SkAIxu IDE Blog', excerpt: 'When you click the element you mean, the AI stops guessing. Preview targeting turns intent into evidence. Launch the live SkAIxu IDE at https://skaixuidepro.netlify.app.', published_at: '2025-10-01T00:00:00.000Z', tags: ["SkAIxu", "AI", "IDE"], staticUrl: 'Blogs/Skaixu/skaixu_blog_02_preview-to-patch-targeting-click-to-edit-that-stops-ambiguity.html' },
    { slug: 'skaixu-blog-01-patch-driven-editing-the-anti-drift-contract-for-ai-code-changes', title: 'Patch-Driven Editing: The Anti-Drift Contract for AI Code Changes | SkAIxu IDE Blog', excerpt: 'Why AI coding breaks in production—and how patch contracts (SEARCH/REPLACE) turn AI suggestions into controlled change requests. Launch the live SkAIxu IDE at https://skaixuidepro.netlify.app.', published_at: '2025-09-22T00:00:00.000Z', tags: ["SkAIxu", "AI", "IDE"], staticUrl: 'Blogs/Skaixu/skaixu_blog_01_patch-driven-editing-the-anti-drift-contract-for-ai-code-changes.html' },
    { slug: '10-arizona-contracts-deposits-invoicing-system', title: 'Arizona Contracts, Deposits & Invoicing (Phoenix Operator System That Actually Collects)', excerpt: 'A full operator-grade system for Arizona service businesses: contract structure, deposit terms, scope control, change orders, invoicing cadence, late fees, collections scripts, and copy‑paste clauses.', published_at: '2025-09-05T00:00:00.000Z', tags: ["Phoenix", "Business", "Arizona"], staticUrl: 'Blogs/Phoenix Arizona/10_arizona_contracts_deposits_invoicing_system.html' },
    { slug: '09-phoenix-sales-tax-vs-arizona-tpt', title: 'Phoenix Sales Tax vs Arizona TPT (What’s the Difference—and Why You Care)', excerpt: 'Arizona’s “sales tax” is actually Transaction Privilege Tax (TPT): a tax on the vendor for doing business. Learn the difference, how Phoenix rates fit in, and how operators invoice and file without cr', published_at: '2025-08-27T00:00:00.000Z', tags: ["Phoenix", "Business", "Arizona"], staticUrl: 'Blogs/Phoenix Arizona/09_phoenix_sales_tax_vs_arizona_tpt.html' },
    { slug: '08-phoenix-home-based-business-zoning-rules', title: 'Phoenix Zoning & Home‑Based Business Rules (Home Occupations: Operator Playbook)', excerpt: 'Running a home-based business in Phoenix? Learn the home occupation standards, when use permits apply, what triggers complaints, and how to design operations that stay compliant while scaling.', published_at: '2025-08-18T00:00:00.000Z', tags: ["Phoenix", "Business", "Arizona"], staticUrl: 'Blogs/Phoenix Arizona/08_phoenix_home_based_business_zoning_rules.html' },
    { slug: '07-arizona-statutory-agent-registered-agent', title: 'Do I Need a Registered Agent in Arizona? (Statutory Agent: The Operator Guide)', excerpt: 'Arizona requires a statutory agent (registered agent equivalent). Learn what they do, how acceptance works, how to choose one, and how Phoenix operators prevent legal-notice disasters.', published_at: '2025-08-09T00:00:00.000Z', tags: ["Phoenix", "Business", "Arizona"], staticUrl: 'Blogs/Phoenix Arizona/07_arizona_statutory_agent_registered_agent.html' },
    { slug: '06-how-to-get-an-ein-arizona', title: 'How to Get an EIN in Arizona (Phoenix Owners: Free, Fast, Correct)', excerpt: 'Get your EIN directly from the IRS for free—avoid fake “IRS” sites. Step-by-step EIN checklist for Phoenix businesses, plus what to do immediately after you receive it.', published_at: '2025-07-31T00:00:00.000Z', tags: ["Phoenix", "Business", "Arizona"], staticUrl: 'Blogs/Phoenix Arizona/06_how_to_get_an_ein_arizona.html' },
    { slug: '05-arizona-tpt-license-who-needs-it', title: 'Do I Need a TPT License in Arizona? (Phoenix Operators: Read This First)', excerpt: 'Arizona uses Transaction Privilege Tax (TPT). Learn who needs a TPT license, the $12 state license fee per location, city program fees, and the operator process to register and file correctly.', published_at: '2025-07-22T00:00:00.000Z', tags: ["Phoenix", "Business", "Arizona"], staticUrl: 'Blogs/Phoenix Arizona/05_arizona_tpt_license_who_needs_it.html' },
    { slug: '04-phoenix-business-license-requirements', title: 'Do I Need a Business License in Phoenix, AZ? (What Phoenix Actually Requires)', excerpt: 'Phoenix does not issue a general business license. Learn what that really means, when specific licensing applies, and the operator checklist to stay compliant without wasting time.', published_at: '2025-07-13T00:00:00.000Z', tags: ["Phoenix", "Business", "Arizona"], staticUrl: 'Blogs/Phoenix Arizona/04_phoenix_business_license_requirements.html' },
    { slug: '03-arizona-llc-cost-breakdown', title: 'How Much Does an LLC Cost in Arizona? (Real Phoenix Operator Budget)', excerpt: 'Arizona LLC cost breakdown for Phoenix: ACC filing fees, expedited options, statutory agent costs, publication considerations, and the real startup budget most owners forget.', published_at: '2025-07-04T00:00:00.000Z', tags: ["Phoenix", "Business", "Arizona"], staticUrl: 'Blogs/Phoenix Arizona/03_arizona_llc_cost_breakdown.html' },
    { slug: '02-how-to-start-llc-arizona-phoenix', title: 'How to Start an LLC in Arizona (Phoenix Step‑by‑Step, Operator Clean)', excerpt: 'Exact Arizona LLC steps for Phoenix founders: ACC filing, statutory agent acceptance, publication rules, EIN, and the first-week operator setup that prevents future mess.', published_at: '2025-06-26T00:00:00.000Z', tags: ["Phoenix", "Business", "Arizona"], staticUrl: 'Blogs/Phoenix Arizona/02_how_to_start_llc_arizona_phoenix.html' },
    { slug: '01-phoenix-start-business-playbook', title: 'Start & Run a Business in Phoenix, AZ (LLC + Compliance + Profit Systems)', excerpt: 'A dense Phoenix operator playbook: form your Arizona LLC, get EIN, handle TPT, validate Phoenix rules, and install a contract+deposit system that keeps you compliant and profitable.', published_at: '2025-06-17T00:00:00.000Z', tags: ["Phoenix", "Business", "Arizona"], staticUrl: 'Blogs/Phoenix Arizona/01_phoenix_start_business_playbook.html' },
    { slug: 'payhawk-is-revolutionizing-pay-plan-design-for-small-businesses', title: 'PayHawk: AI-Powered Pay Plan Compliance Wizard | Stop Guessing, Start Complying', excerpt: 'PayHawk helps small business owners design legal hourly + commission pay structures with AI-powered compliance analysis, risk flags, and copy-ready language. Free tool using 2026 minimum wage data.', published_at: '2025-06-08T00:00:00.000Z', tags: ["pay plan compliance", "minimum wage 2026", "commission pay structure"], staticUrl: 'Blogs/PayHawk Is Revolutionizing Pay Plan Design for Small Businesses.html' },
    { slug: 'establishing-business-development-firm-phoenix-az', title: 'Skyes Over London LC — Launch | Phoenix Enterprise Architecture • LONDON Framework™', excerpt: 'Skyes Over London LC is now live: enterprise architecture, authority systems, and platform ecosystems built for Phoenix operators and national expansion. Start with the Enterprise Diagnostic, then dep', published_at: '2025-06-01T00:00:00.000Z', tags: ["Promotions", "Phoenix", "13th SOLE"], staticUrl: 'Blogs/13th Sole Promotions/Establishing-Business-Development-Firm-Phoenix-AZ.html' },
    { slug: 'mysfits-modern-juke-joint-experience', title: 'Skyes Over London | Chicago Doesn’t Need More Gatekeepers — It Needs Rooms Like This', excerpt: 'From Skyes Over London\'s perspective: spotlighting Mysfit’s Modern Juke Joint Experience — a #NoGateKeepingChicago live showcase + networking night built on community, authenticity, and creative safet', published_at: '2025-06-01T00:00:00.000Z', tags: ["Promotions", "Phoenix", "13th SOLE"], staticUrl: 'Blogs/13th Sole Promotions/Mysfit’s-Modern-Juke-Joint-Experience.html' },
    { slug: 'commonphoenixllcproblems', title: 'Common Phoenix LLC Mistakes (and the prevention checklists that stop them)', excerpt: 'Phoenix/Arizona operators make the same LLC mistakes: TPT confusion, zoning blind spots, scope creep, commingling, and weak invoicing. Here’s the prevention playbook with checklists.', published_at: '2025-06-01T00:00:00.000Z', tags: [], staticUrl: 'Blogs/CommonPhoenixLLCProblems.html' },
    { slug: 'ai-gateway-one-contract', title: 'AI Gateways: One Contract to Rule Multi‑Provider Models', excerpt: 'How a gateway stabilizes your app while providers change models, prices, and policies underneath you.', published_at: '2025-06-01T00:00:00.000Z', tags: ["Dev", "AI", "Engineering"], staticUrl: 'Blogs/Editorials/Devs & AI/ai-gateway-one-contract.html' },
    { slug: 'magic-links-done-right', title: 'Magic Links Done Right: Passwordless Auth Without Pain', excerpt: 'How to implement email magic links with minimal attack surface and a clean UX that users actually trust.', published_at: '2025-06-01T00:00:00.000Z', tags: ["Dev", "AI", "Engineering"], staticUrl: 'Blogs/Editorials/Devs & AI/magic-links-done-right.html' },
    { slug: 'minimal-rbac-that-works', title: 'RBAC for Humans: Minimal Roles That Actually Work', excerpt: 'A starter RBAC model (owner/admin/member/viewer) you can ship today—without building an IAM cathedral.', published_at: '2025-06-01T00:00:00.000Z', tags: ["Dev", "AI", "Engineering"], staticUrl: 'Blogs/Editorials/Devs & AI/minimal-rbac-that-works.html' },
    { slug: 'neon-schema-versioning', title: 'Neon Postgres: Schema Versioning Without Tears', excerpt: 'A pragmatic approach to migrations, compatibility, and rollbacks—especially when multiple apps share a DB.', published_at: '2025-06-01T00:00:00.000Z', tags: ["Dev", "AI", "Engineering"], staticUrl: 'Blogs/Editorials/Devs & AI/neon-schema-versioning.html' },
    { slug: 'netlify-functions-practical-patterns', title: 'Netlify Functions at Scale: Practical Patterns for Real Apps', excerpt: 'Route design, validation, retries, and timeouts—what matters when serverless leaves the tutorial phase.', published_at: '2025-06-01T00:00:00.000Z', tags: ["Dev", "AI", "Engineering"], staticUrl: 'Blogs/Editorials/Devs & AI/netlify-functions-practical-patterns.html' },
    { slug: 'observability-for-ai-apps', title: 'Observability for AI Apps: Traces, Prompts, and Policy', excerpt: 'What to log, how to correlate it, and how to debug failures without guessing or staring at token counts.', published_at: '2025-06-01T00:00:00.000Z', tags: ["Dev", "AI", "Engineering"], staticUrl: 'Blogs/Editorials/Devs & AI/observability-for-ai-apps.html' },
    { slug: 'offline-first-ai-patterns', title: 'Edge AI on a Budget: Offline‑First Patterns That Scale', excerpt: 'Design patterns for PWAs that keep working when connectivity fails—then sync cleanly when it returns.', published_at: '2025-06-01T00:00:00.000Z', tags: ["Dev", "AI", "Engineering"], staticUrl: 'Blogs/Editorials/Devs & AI/offline-first-ai-patterns.html' },
    { slug: 'prompt-hygiene-production', title: 'The Hidden Cost of Context: Prompt Hygiene for Production', excerpt: 'Why the best AI apps don’t just ‘prompt better’—they treat prompts like code: versioned, tested, and observable.', published_at: '2025-06-01T00:00:00.000Z', tags: ["Dev", "AI", "Engineering"], staticUrl: 'Blogs/Editorials/Devs & AI/prompt-hygiene-production.html' },
    { slug: 'rag-retrieval-that-doesnt-lie', title: 'RAG Is Not a Vibe: Retrieval That Doesn’t Lie', excerpt: 'Retrieval-Augmented Generation (RAG) works when it’s measurable, auditable, and brutally honest about uncertainty.', published_at: '2025-06-01T00:00:00.000Z', tags: ["Dev", "AI", "Engineering"], staticUrl: 'Blogs/Editorials/Devs & AI/rag-retrieval-that-doesnt-lie.html' },
    { slug: 'script-to-system-productizing-dev-work', title: 'From Script to System: Productizing Dev Work Without Killing Velocity', excerpt: 'Turning internal tools into sellable products by tightening inputs, outputs, and ownership lines.', published_at: '2025-06-01T00:00:00.000Z', tags: ["Dev", "AI", "Engineering"], staticUrl: 'Blogs/Editorials/Devs & AI/script-to-system-productizing-dev-work.html' },
    { slug: 'shipping-like-a-scientist', title: 'Shipping Like a Scientist: Experiment Loops for Product Teams', excerpt: 'Treat features as hypotheses. Measure. Learn. Repeat. Ship faster by getting less precious about being right.', published_at: '2025-06-01T00:00:00.000Z', tags: ["Dev", "AI", "Engineering"], staticUrl: 'Blogs/Editorials/Devs & AI/shipping-like-a-scientist.html' },
    { slug: 'token-economics-indisputable-billing', title: 'Token Economics: How to Make AI Billing Indisputable', excerpt: 'A practical blueprint for logging raw usage and generating invoices from a versioned pricing table—no vibes, no disputes.', published_at: '2025-06-01T00:00:00.000Z', tags: ["Dev", "AI", "Engineering"], staticUrl: 'Blogs/Editorials/Devs & AI/token-economics-indisputable-billing.html' },
    { slug: 'why-blocked-ux', title: 'Guardrails Without Rage: Designing ‘Why Blocked’ UX', excerpt: 'Users don’t hate limits—they hate mystery. Make policy failures legible without leaking secrets.', published_at: '2025-06-01T00:00:00.000Z', tags: ["Dev", "AI", "Engineering"], staticUrl: 'Blogs/Editorials/Devs & AI/why-blocked-ux.html' },
    { slug: 'webpile-promonaco-editor', title: 'Webpile Pro—Monaco Editor', excerpt: '', published_at: '2025-06-01T00:00:00.000Z', tags: ["Editorial", "SOL"], staticUrl: 'Blogs/Editorials/WebPile Pro—Monaco Editor.html' },
    { slug: 'mysfitsmodernjukejointexperience', title: 'Mysfit’s Modern Juke Joint Experience | #NoGateKeepingChicago', excerpt: 'A live showcase + networking experience rooted in community, authenticity, and creative safety. No gatekeeping. No pay-to-play. Just Chicago talent—performing, connecting, and building.', published_at: '2025-06-01T00:00:00.000Z', tags: [], staticUrl: 'Blogs/Mysfit’sModernJukeJointExperience.html' },
    { slug: 'phoenixvalleybloghome', title: 'Blog Hub', excerpt: 'Manual-path blog hub page. Fill slots with file paths to publish posts.', published_at: '2025-06-01T00:00:00.000Z', tags: [], staticUrl: 'Blogs/PhoenixValleyBlogHome.html' },
    { slug: 'what-even-is-seo', title: 'What Even Is Seo', excerpt: '', published_at: '2025-06-01T00:00:00.000Z', tags: [], staticUrl: 'Blogs/What-Even-Is-SEO.html' },
    { slug: 'whenleadsgoupfiredrillsgouptoo', title: 'Arizona’s “Busy but Not In Control” Trap', excerpt: 'Arizona operators scaling real volume often hit a hidden bottleneck: digital demand and fulfillment don’t connect. Explore a connected operating system for Logistics, Digital Growth, and Apex Intellig', published_at: '2025-06-01T00:00:00.000Z', tags: ["Arizona logistics", "Phoenix operations", "dispatch systems"], staticUrl: 'Blogs/WhenLeadsGoUp,FireDrillsGoUpToo.html' },
    { slug: 'sol-ops-field-brief', title: 'Sol Ops Field Brief', excerpt: '', published_at: '2025-06-01T00:00:00.000Z', tags: [], staticUrl: 'Blogs/sol-ops-field-brief.html' },
    { slug: 'houston-space-intuitive-machines', title: 'Houston AI & Dev Spotlight: Intuitive Machines', excerpt: 'width=device-width, initial-scale=1.0" name="viewport"/> <meta content="IE=edge" http-equiv="X-UA-Compatible"/> <title>Houston AI & Dev Spotlight: Intuitive Machines | Skyes Over London LC</title> <me', published_at: '2025-05-21T00:00:00.000Z', tags: ["Dev", "AI", "Engineering"], staticUrl: 'Blogs/Houston Texas Devs & AI/houston-space-intuitive-machines.html' },
    { slug: 'houston-space-axiom-space', title: 'Houston AI & Dev Spotlight: Axiom Space', excerpt: 'width=device-width, initial-scale=1.0" name="viewport"/> <meta content="IE=edge" http-equiv="X-UA-Compatible"/> <title>Houston AI & Dev Spotlight: Axiom Space | Skyes Over London LC</title> <meta cont', published_at: '2025-05-12T00:00:00.000Z', tags: ["Dev", "AI", "Engineering"], staticUrl: 'Blogs/Houston Texas Devs & AI/houston-space-axiom-space.html' },
    { slug: 'houston-enterprise-chevron-hq', title: 'Houston AI & Dev Spotlight: Chevron', excerpt: 'width=device-width, initial-scale=1.0" name="viewport"/> <meta content="IE=edge" http-equiv="X-UA-Compatible"/> <title>Houston AI & Dev Spotlight: Chevron | Skyes Over London LC</title> <meta content=', published_at: '2025-05-03T00:00:00.000Z', tags: ["Dev", "AI", "Engineering"], staticUrl: 'Blogs/Houston Texas Devs & AI/houston-enterprise-chevron-hq.html' },
    { slug: 'houston-dev-softeq', title: 'Houston AI & Dev Spotlight: Softeq', excerpt: 'width=device-width, initial-scale=1.0" name="viewport"/> <meta content="IE=edge" http-equiv="X-UA-Compatible"/> <title>Houston AI & Dev Spotlight: Softeq | Skyes Over London LC</title> <meta content="', published_at: '2025-04-25T00:00:00.000Z', tags: ["Dev", "AI", "Engineering"], staticUrl: 'Blogs/Houston Texas Devs & AI/houston-dev-softeq.html' },
    { slug: 'houston-dev-hpe-headquarters', title: 'Houston AI & Dev Spotlight: Hewlett Packard Enterprise', excerpt: 'width=device-width, initial-scale=1.0" name="viewport"/> <meta content="IE=edge" http-equiv="X-UA-Compatible"/> <title>Houston AI & Dev Spotlight: Hewlett Packard Enterprise | Skyes Over London LC</ti', published_at: '2025-04-16T00:00:00.000Z', tags: ["Dev", "AI", "Engineering"], staticUrl: 'Blogs/Houston Texas Devs & AI/houston-dev-hpe-headquarters.html' },
    { slug: 'houston-ai-slb-innovation-factori', title: 'Houston AI & Dev Spotlight: SLB', excerpt: 'width=device-width, initial-scale=1.0" name="viewport"/> <meta content="IE=edge" http-equiv="X-UA-Compatible"/> <title>Houston AI & Dev Spotlight: SLB | Skyes Over London LC</title> <meta content="Hou', published_at: '2025-04-07T00:00:00.000Z', tags: ["Dev", "AI", "Engineering"], staticUrl: 'Blogs/Houston Texas Devs & AI/houston-ai-slb-innovation-factori.html' },
    { slug: 'houston-ai-pros', title: 'Houston AI & Dev Spotlight: PROS', excerpt: 'width=device-width, initial-scale=1.0" name="viewport"/> <meta content="IE=edge" http-equiv="X-UA-Compatible"/> <title>Houston AI & Dev Spotlight: PROS | Skyes Over London LC</title> <meta content="Ho', published_at: '2025-03-29T00:00:00.000Z', tags: ["Dev", "AI", "Engineering"], staticUrl: 'Blogs/Houston Texas Devs & AI/houston-ai-pros.html' },
    { slug: 'houston-ai-kbr', title: 'Houston AI & Dev Spotlight: KBR', excerpt: 'width=device-width, initial-scale=1.0" name="viewport"/> <meta content="IE=edge" http-equiv="X-UA-Compatible"/> <title>Houston AI & Dev Spotlight: KBR | Skyes Over London LC</title> <meta content="Hou', published_at: '2025-03-20T00:00:00.000Z', tags: ["Dev", "AI", "Engineering"], staticUrl: 'Blogs/Houston Texas Devs & AI/houston-ai-kbr.html' },
    { slug: 'houston-ai-halliburton-digital', title: 'Houston AI & Dev Spotlight: Halliburton', excerpt: 'width=device-width, initial-scale=1.0" name="viewport"/> <meta content="IE=edge" http-equiv="X-UA-Compatible"/> <title>Houston AI & Dev Spotlight: Halliburton | Skyes Over London LC</title> <meta cont', published_at: '2025-03-11T00:00:00.000Z', tags: ["Dev", "AI", "Engineering"], staticUrl: 'Blogs/Houston Texas Devs & AI/houston-ai-halliburton-digital.html' },
    { slug: 'houston-ai-data-gumbo', title: 'Houston AI & Dev Spotlight: Data Gumbo', excerpt: 'width=device-width, initial-scale=1.0" name="viewport"/> <meta content="IE=edge" http-equiv="X-UA-Compatible"/> <title>Houston AI & Dev Spotlight: Data Gumbo | Skyes Over London LC</title> <meta conte', published_at: '2025-03-02T00:00:00.000Z', tags: ["Dev", "AI", "Engineering"], staticUrl: 'Blogs/Houston Texas Devs & AI/houston-ai-data-gumbo.html' },
    { slug: 'houston-ai-chaione', title: 'Houston AI & Dev Spotlight: ChaiOne', excerpt: 'width=device-width, initial-scale=1.0" name="viewport"/> <meta content="IE=edge" http-equiv="X-UA-Compatible"/> <title>Houston AI & Dev Spotlight: ChaiOne | Skyes Over London LC</title> <meta content=', published_at: '2025-02-21T00:00:00.000Z', tags: ["Dev", "AI", "Engineering"], staticUrl: 'Blogs/Houston Texas Devs & AI/houston-ai-chaione.html' },
    { slug: 'houston-ai-cemvita', title: 'Houston AI & Dev Spotlight: Cemvita', excerpt: 'width=device-width, initial-scale=1.0" name="viewport"/> <meta content="IE=edge" http-equiv="X-UA-Compatible"/> <title>Houston AI & Dev Spotlight: Cemvita | Skyes Over London LC</title> <meta content=', published_at: '2025-02-13T00:00:00.000Z', tags: ["Dev", "AI", "Engineering"], staticUrl: 'Blogs/Houston Texas Devs & AI/houston-ai-cemvita.html' },
    { slug: 'houston-ai-bmc-software', title: 'Houston AI & Dev Spotlight: BMC Software', excerpt: 'width=device-width, initial-scale=1.0" name="viewport"/> <meta content="IE=edge" http-equiv="X-UA-Compatible"/> <title>Houston AI & Dev Spotlight: BMC Software | Skyes Over London LC</title> <meta con', published_at: '2025-02-04T00:00:00.000Z', tags: ["Dev", "AI", "Engineering"], staticUrl: 'Blogs/Houston Texas Devs & AI/houston-ai-bmc-software.html' },
    { slug: 'billions-stolen-fom-american-workers', title: 'Empowering America\'s Workforce: The Worker & Contractor Resource Center', excerpt: 'A comprehensive free platform fighting wage theft, unsafe conditions, and workplace retaliation across all 50 states. State-by-state resources, legal contacts, and ready-to-use scripts for workers and', published_at: '2025-01-26T00:00:00.000Z', tags: ["Editorial", "SOL"], staticUrl: 'Blogs/Editorials/billions_stolen_fom_American_workers.html' },
    { slug: 'one-website-cant-carry-your-authority-alone', title: 'Sentinel Web Authority™ — Distributed SEO & Brand Authority System', excerpt: 'Build an authority ecosystem Google trusts. Sentinel Web Authority™ deploys up to 5 branded websites with editorial-grade content that compounds trust signals and reinforces your primary site strategi', published_at: '2025-01-08T00:00:00.000Z', tags: ["Editorial", "SOL"], staticUrl: 'Blogs/Editorials/One-Website-Can\'t-Carry-Your-Authority-Alone.html' },
    { slug: 'phoenix-year-end-close-30-day-playbook', title: 'Phoenix Year-End Close: The 30-Day Playbook to Walk Into Tax Season Calmly | NorthStar Office & Accounting LLC', excerpt: 'A NorthStar editorial for Phoenix operators: year-end close playbook, reconciliations, documentation posture, contractor/payroll readiness, and a month-by-month cadence that makes tax season less chao', published_at: '2024-12-30T00:00:00.000Z', tags: ["Finance", "Operations", "Phoenix"], staticUrl: 'Blogs/Editorials/NorthStar/phoenix-year-end-close-30-day-playbook.html' },
    { slug: 'phoenix-quickbooks-cleanup-ledger-rescue', title: 'Phoenix QuickBooks Cleanup: The Ledger Rescue That Turns Chaos Into Tax-Ready Books | NorthStar Office & Accounting LLC', excerpt: 'A NorthStar editorial for Phoenix operators: QuickBooks cleanup, reconciliations, chart-of-accounts repair, and a close cadence that produces bank-ready statements and tax-ready books—without the year', published_at: '2024-12-21T00:00:00.000Z', tags: ["Finance", "Operations", "Phoenix"], staticUrl: 'Blogs/Editorials/NorthStar/phoenix-quickbooks-cleanup-ledger-rescue.html' },
    { slug: 'phoenix-payroll-cadence-quarter-close-discipline', title: 'Phoenix Payroll Cadence: The Quarter-Close Discipline That Prevents Penalties | NorthStar Office & Accounting LLC', excerpt: 'A NorthStar editorial for Phoenix operators: payroll cadence, reconciliation discipline, documentation posture, and a monthly close rhythm that keeps payroll from becoming a quarterly crisis.', published_at: '2024-12-12T00:00:00.000Z', tags: ["Finance", "Operations", "Phoenix"], staticUrl: 'Blogs/Editorials/NorthStar/phoenix-payroll-cadence-quarter-close-discipline.html' },
    { slug: 'phoenix-cash-flow-forecasting-13-week-clarity', title: 'Phoenix Cash-Flow Forecasting: The 13-Week System That Stops Surprises | NorthStar Office & Accounting LLC', excerpt: 'A NorthStar editorial for Phoenix operators: cash-flow forecasting, 13-week visibility, collections and payables cadence, and a monthly close foundation that turns cash posture into a controllable sys', published_at: '2024-12-04T00:00:00.000Z', tags: ["Finance", "Operations", "Phoenix"], staticUrl: 'Blogs/Editorials/NorthStar/phoenix-cash-flow-forecasting-13-week-clarity.html' },
    { slug: 'phoenix-1099-contractor-tracking-year-end-ready', title: 'Phoenix 1099 Contractor Tracking: The Cadence That Prevents Year-End Chaos | NorthStar Office & Accounting LLC', excerpt: 'A NorthStar editorial for Phoenix operators: 1099 contractor tracking, W-9 discipline, payment history hygiene, and a monthly close cadence that makes year-end reporting calmer and more defensible.', published_at: '2024-11-25T00:00:00.000Z', tags: ["Finance", "Operations", "Phoenix"], staticUrl: 'Blogs/Editorials/NorthStar/phoenix-1099-contractor-tracking-year-end-ready.html' },
    { slug: 'bank-ready-financials-phoenix-loans-lines', title: 'Bank-Ready Financials: How Phoenix Businesses Win Loans and Lines of Credit | NorthStar Office & Accounting LLC', excerpt: 'A NorthStar editorial for Phoenix operators: bank-ready financials, underwriting-ready statements, documentation posture, and a monthly close cadence that makes lenders trust your numbers faster.', published_at: '2024-11-16T00:00:00.000Z', tags: ["Finance", "Operations", "Phoenix"], staticUrl: 'Blogs/Editorials/NorthStar/bank-ready-financials-phoenix-loans-lines.html' },
    { slug: 'arizona-tpt-record-posture-phoenix-operators', title: 'Arizona TPT for Phoenix Operators: The Record Posture That Survives Filing Season | NorthStar Office & Accounting LLC', excerpt: 'A NorthStar editorial for Phoenix, Arizona operators: Arizona TPT record posture, sales activity documentation, exemption discipline, and a monthly close rhythm that prevents “guessing season.”', published_at: '2024-11-07T00:00:00.000Z', tags: ["Finance", "Operations", "Phoenix"], staticUrl: 'Blogs/Editorials/NorthStar/arizona-tpt-record-posture-phoenix-operators.html' },
    { slug: 'vercel', title: 'Vercel: Shipping AI Apps Like You Ship Web Apps | CA AI & Dev Field Notes', excerpt: 'Vercel makes “deploy” boring—in a good way—so teams can focus on product, not infrastructure, even when they’re streaming LLM output at scale.', published_at: '2024-07-06T00:00:00.000Z', tags: ["AI", "Colorado", "Tech"], staticUrl: 'Blogs/Editorials/Colorado AI/vercel.html' },
    { slug: 'scale-ai', title: 'Scale AI: Data, Evaluation, and Enterprise GenAI Infrastructure | CA AI & Dev Field Notes', excerpt: 'Scale focuses on the parts that make modern AI real in production: data pipelines, evaluation, and full-stack enterprise deployment surfaces.', published_at: '2024-06-27T00:00:00.000Z', tags: ["AI", "Colorado", "Tech"], staticUrl: 'Blogs/Editorials/Colorado AI/scale-ai.html' },
    { slug: 'salesforce-einstein-agentforce', title: 'Salesforce Einstein & Agentforce: AI That Lives Where the Customers Live | CA AI & Dev Field Notes', excerpt: 'Salesforce’s AI story is about embedding AI into the workflow: predictions, generation, and agents inside CRM and business processes.', published_at: '2024-06-18T00:00:00.000Z', tags: ["AI", "Colorado", "Tech"], staticUrl: 'Blogs/Editorials/Colorado AI/salesforce-einstein-agentforce.html' },
    { slug: 'perplexity', title: 'Perplexity: The Answer Engine Pattern (Search + LLM + Sources) | CA AI & Dev Field Notes', excerpt: 'Perplexity popularized a product shape many teams now copy: conversational answers that keep citations and sources in the loop.', published_at: '2024-06-09T00:00:00.000Z', tags: ["AI", "Colorado", "Tech"], staticUrl: 'Blogs/Editorials/Colorado AI/perplexity.html' },
    { slug: 'openai', title: 'OpenAI: The API Platform That Turns Models into Products | CA AI & Dev Field Notes', excerpt: 'A developer-first look at OpenAI’s platform surfaces—models, realtime experiences, and agent building—through the lens of practical shipping.', published_at: '2024-05-31T00:00:00.000Z', tags: ["AI", "Colorado", "Tech"], staticUrl: 'Blogs/Editorials/Colorado AI/openai.html' },
    { slug: 'nvidia-cuda', title: 'CUDA: The Gravity Well of GPU-Accelerated Development | CA AI & Dev Field Notes', excerpt: 'CUDA is a toolkit, an ecosystem, and—practically speaking—a default target for high-performance ML workloads and GPU-heavy applications.', published_at: '2024-05-23T00:00:00.000Z', tags: ["AI", "Colorado", "Tech"], staticUrl: 'Blogs/Editorials/Colorado AI/nvidia-cuda.html' },
    { slug: 'meta-ai', title: 'Meta AI: The Research Engine Behind a Developer Ecosystem | CA AI & Dev Field Notes', excerpt: 'Meta’s AI org is a research-heavy force that also shapes tooling and model ecosystems used far beyond Meta’s own products.', published_at: '2024-05-14T00:00:00.000Z', tags: ["AI", "Colorado", "Tech"], staticUrl: 'Blogs/Editorials/Colorado AI/meta-ai.html' },
    { slug: 'google-vertex-ai', title: 'Vertex AI: When You Want GenAI and MLOps Under One Roof | CA AI & Dev Field Notes', excerpt: 'Vertex AI is the cloud-native “everything box” for training, deployment, monitoring, and productionized generative AI—especially when your stack already lives on GCP.', published_at: '2024-05-05T00:00:00.000Z', tags: ["AI", "Colorado", "Tech"], staticUrl: 'Blogs/Editorials/Colorado AI/google-vertex-ai.html' },
    { slug: 'github-copilot', title: 'GitHub Copilot: The Developer Tool That Moved AI Into the Daily Loop | CA AI & Dev Field Notes', excerpt: 'Copilot isn’t “AI for developers” in theory—it’s AI embedded into editors, repos, and workflows where code actually happens.', published_at: '2024-04-26T00:00:00.000Z', tags: ["AI", "Colorado", "Tech"], staticUrl: 'Blogs/Editorials/Colorado AI/github-copilot.html' },
    { slug: 'databricks-mosaic-ai', title: 'Databricks Mosaic AI: Building GenAI Where the Data Already Is | CA AI & Dev Field Notes', excerpt: 'Mosaic AI is about governed, production-grade generative AI in the enterprise: agents, evaluation, serving, and traffic governance around models.', published_at: '2024-04-17T00:00:00.000Z', tags: ["AI", "Colorado", "Tech"], staticUrl: 'Blogs/Editorials/Colorado AI/databricks-mosaic-ai.html' },
    { slug: 'apple-core-ml', title: 'Core ML: On-Device AI That Ships with Your App | CA AI & Dev Field Notes', excerpt: 'Core ML is the “bring the model to the device” philosophy: low latency, offline-ready, and privacy-friendly—with a mature conversion toolchain.', published_at: '2024-04-08T00:00:00.000Z', tags: ["AI", "Colorado", "Tech"], staticUrl: 'Blogs/Editorials/Colorado AI/apple-core-ml.html' },
    { slug: 'anthropic', title: 'Anthropic: Claude as a Developer Platform (Not Just a Chatbot) | CA AI & Dev Field Notes', excerpt: 'Claude’s developer surface emphasizes reliability, long-context workflows, and a clean Messages API that slots neatly into modern app backends.', published_at: '2024-03-30T00:00:00.000Z', tags: ["AI", "Colorado", "Tech"], staticUrl: 'Blogs/Editorials/Colorado AI/anthropic.html' },
    { slug: 'adobe-firefly', title: 'Adobe Firefly: Generative Media That Plays Nice with Creative Workflows | CA AI & Dev Field Notes', excerpt: 'Firefly’s value to developers and teams is the integration: creative generation and editing that fits within Creative Cloud’s real production habits.', published_at: '2024-03-21T00:00:00.000Z', tags: ["AI", "Colorado", "Tech"], staticUrl: 'Blogs/Editorials/Colorado AI/adobe-firefly.html' },
    { slug: 'free-events-phoenix', title: 'Things to Do in Phoenix (Feb 2026) — Free Web & Business Events', excerpt: 'A cinematic, interactive city-desk guide to free, in-person Phoenix events in February 2026 for web development and business development—with RSVP links.', published_at: '2024-02-24T00:00:00.000Z', tags: ["Promotions", "Phoenix", "13th SOLE"], staticUrl: 'Blogs/13th Sole Promotions/Free-events-Phoenix.html' },
  ];

  function esc(s){
    return String(s ?? '').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  }

  function fmtDate(iso){
    try {
      const d = new Date(iso);
      return d.toLocaleDateString(undefined, { year:'numeric', month:'short', day:'2-digit' });
    } catch { return iso || ''; }
  }

  async function jsonFetch(url, opts={}){
    const res = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        ...(opts.headers || {})
      },
      ...opts,
    });
    const text = await res.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch { data = { raw: text }; }
    if (!res.ok) {
      const msg = (data && (data.error || data.message)) ? (data.error || data.message) : `Request failed (${res.status})`;
      const err = new Error(msg);
      err.status = res.status;
      err.data = data;
      throw err;
    }
    return data;
  }

  function miniMarkdown(md){
    // Safe-ish markdown subset: headings, bold/italics, code, links, lists, paragraphs.
    // We intentionally do NOT support raw HTML.
    const lines = String(md || '').split(/\r?\n/);
    const out = [];
    let inCode = false;
    let listOpen = false;

    function closeList(){
      if (listOpen) { out.push('</ul>'); listOpen = false; }
    }

    for (let i=0;i<lines.length;i++){
      let line = lines[i];

      if (line.trim().startsWith('```')){
        closeList();
        inCode = !inCode;
        out.push(inCode ? '<pre class="md-code"><code>' : '</code></pre>');
        continue;
      }

      if (inCode){
        out.push(esc(line) + '\n');
        continue;
      }

      // headings
      const h = line.match(/^(#{1,6})\s+(.*)$/);
      if (h){
        closeList();
        const lvl = h[1].length;
        out.push(`<h${lvl} class="md-h${lvl}">${inlineMd(h[2])}</h${lvl}>`);
        continue;
      }

      // list
      const li = line.match(/^\s*[-*]\s+(.*)$/);
      if (li){
        if (!listOpen){ out.push('<ul class="md-ul">'); listOpen = true; }
        out.push(`<li>${inlineMd(li[1])}</li>`);
        continue;
      }

      // blank line
      if (!line.trim()){
        closeList();
        out.push('<div class="md-spacer"></div>');
        continue;
      }

      closeList();
      out.push(`<p class="md-p">${inlineMd(line)}</p>`);
    }

    closeList();
    return out.join('\n');

    function inlineMd(text){
      let t = esc(text);
      // code
      t = t.replace(/`([^`]+)`/g, (_, c) => `<code class="md-inline">${esc(c)}</code>`);
      // bold
      t = t.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
      // italics
      t = t.replace(/\*([^*]+)\*/g, '<em>$1</em>');
      // links [text](url)
      t = t.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
      return t;
    }
  }

  // ─────────────────────────────────────────────
  // Identity helpers (optional)
  // ─────────────────────────────────────────────
  function initIdentity(){
    if (!window.netlifyIdentity) return;
    state.identityReady = true;
    try {
      state.user = window.netlifyIdentity.currentUser();
    } catch {}

    window.netlifyIdentity.on('login', user => {
      state.user = user;
      refreshAuthUI();
    });
    window.netlifyIdentity.on('logout', () => {
      state.user = null;
      refreshAuthUI();
    });
    refreshAuthUI();
  }

  async function getToken(){
    if (!state.user) return null;
    const token = await state.user.jwt(true);
    return token;
  }

  function refreshAuthUI(){
    const el = $('#authBadge');
    if (!el) return;
    if (!state.identityReady) {
      el.innerHTML = '<span class="auth-pill">Auth: Off</span>';
      return;
    }
    if (!state.user){
      el.innerHTML = '<button class="btn-outline btn-sm" id="btnLogin">Login</button>';
      const b = $('#btnLogin');
      if (b) b.addEventListener('click', () => window.netlifyIdentity.open('login'));
      return;
    }
    const email = (state.user.email || '').trim();
    el.innerHTML = `<span class="auth-pill">${esc(email || 'Signed in')}</span><button class="btn-outline btn-sm" id="btnLogout">Logout</button>`;
    const b = $('#btnLogout');
    if (b) b.addEventListener('click', () => window.netlifyIdentity.logout());
  }

  // ─────────────────────────────────────────────
  // Blog (public)
  // ─────────────────────────────────────────────
  async function getManifestPosts(){
    try {
      const data = await jsonFetch('/Blogs/blog-manifest.json');
      return Array.isArray(data?.posts) ? data.posts : [];
    } catch {
      return [];
    }
  }

  async function renderBlogList(){
    const mount = $('#blogList');
    if (!mount) return;

    const search = $('#blogSearch');
    const tagSelect = $('#blogTag');
    const notice = $('#blogNotice');

    let posts = [];
    let seedPosts = [];
    let mode = 'api';
    try {
      const data = await jsonFetch(`${state.apiBase}/blog-list`);
      posts = Array.isArray(data.posts) ? data.posts : [];
    } catch (e){
      mode = 'readonly';
      // fall back to a tiny baked-in seed so the page never looks broken
      seedPosts = [
        {
          slug: 'welcome',
          title: 'Field Notes: Welcome to the SOL Growth Platform',
          excerpt: 'This blog is live. Publishing and gated vault features activate when Netlify Functions + Blobs are deployed.',
          published_at: new Date().toISOString(),
          tags: ['Ops', 'Platform'],
          cover_image: null,
        }
      ];
      if (notice) {
        notice.style.display = 'block';
        notice.innerHTML = 'Blog is running in <strong>read-only mode</strong> (Functions not detected). Deploy with Netlify CLI to enable CMS publishing.';
      }
    }

    const manifestPosts = await getManifestPosts();
    const byKey = new Map();
    [...staticPosts, ...manifestPosts, ...seedPosts, ...posts].forEach((post) => {
      const slugKey = String(post?.slug || '').trim().toLowerCase();
      const urlKey = String(post?.staticUrl || '').trim().toLowerCase();
      const key = slugKey || urlKey || `${String(post?.title || '').trim().toLowerCase()}|${String(post?.published_at || '').trim()}`;
      if (!key) return;

      const existing = byKey.get(key) || {};
      byKey.set(key, { ...existing, ...post });
    });
    posts = Array.from(byKey.values());
    renderNetWorksMenu(posts);

    const allTags = new Set();
    posts.forEach(p => (p.tags || []).forEach(t => allTags.add(t)));
    if (tagSelect) {
      const existing = new Set($$('option', tagSelect).map(o => o.value));
      [...allTags].sort().forEach(t => {
        if (existing.has(t)) return;
        const opt = document.createElement('option');
        opt.value = t; opt.textContent = t;
        tagSelect.appendChild(opt);
      });
    }

    function applyFilters(){
      const q = (search?.value || '').trim().toLowerCase();
      const tag = (tagSelect?.value || '').trim();
      const filtered = posts.filter(p => {
        const hay = `${p.title||''} ${p.excerpt||''} ${(p.tags||[]).join(' ')}`.toLowerCase();
        const okQ = !q || hay.includes(q);
        const okT = !tag || (p.tags||[]).includes(tag);
        return okQ && okT;
      }).sort((a,b) => new Date(b.published_at||0) - new Date(a.published_at||0));
      mount.innerHTML = filtered.map(p => blogCard(p)).join('') || '<div class="empty-state">No posts match your filters.</div>';
      // Re-observe dynamically injected .reveal cards so they animate in
      const revealObs = new IntersectionObserver((entries, obs) => {
        entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('visible'); obs.unobserve(e.target); } });
      }, { threshold: 0.08 });
      mount.querySelectorAll('.reveal').forEach(el => revealObs.observe(el));
    }

    if (search) search.addEventListener('input', applyFilters);
    if (tagSelect) tagSelect.addEventListener('change', applyFilters);

    applyFilters();

    function renderNetWorksMenu(allPosts){
      const menuMount = $('#netWorksMenu');
      if (!menuMount) return;

      const netWorksPosts = allPosts
        .filter((post) => {
          const tags = Array.isArray(post?.tags) ? post.tags : [];
          const hasTag = tags.some((tag) => String(tag).toLowerCase().includes('the net works'));
          const staticUrl = String(post?.staticUrl || '').toLowerCase();
          const slug = String(post?.slug || '').toLowerCase();
          return hasTag || staticUrl.includes('the net works/featuring') || slug.startsWith('the-net-works-');
        })
        .sort((a, b) => new Date(b.published_at || 0) - new Date(a.published_at || 0));

      if (!netWorksPosts.length) {
        menuMount.innerHTML = '<span class="chip">No THE NET WORKS posts found yet.</span>';
        return;
      }

      menuMount.innerHTML = netWorksPosts
        .slice(0, 24)
        .map((post) => {
          const href = post.staticUrl ? post.staticUrl : `post.html?s=${encodeURIComponent(post.slug || '')}`;
          return `<a class="chip" href="${href}">${esc(post.title || 'Untitled Post')}</a>`;
        })
        .join('');
    }

    function blogCard(p){
      const img = p.cover_image ? `<div class="blog-cover"><img src="${esc(p.cover_image)}" alt="${esc(p.title)}" loading="lazy"></div>` : '';
      const tags = (p.tags||[]).slice(0,4).map(t => `<span class="chip">${esc(t)}</span>`).join('');
      const href = p.staticUrl ? p.staticUrl : (mode === 'readonly' && p.slug === 'welcome' ? 'post.html?s=welcome&local=1' : `post.html?s=${encodeURIComponent(p.slug)}`);
      return `
        <article class="blog-card reveal">
          ${img}
          <div class="blog-body">
            <div class="blog-meta">${esc(fmtDate(p.published_at))}</div>
            <h3>${esc(p.title || '')}</h3>
            <p>${esc(p.excerpt || '')}</p>
            <div class="chip-row">${tags}</div>
            <a class="card-link" href="${href}">Read →</a>
          </div>
        </article>
      `;
    }
  }

  async function renderBlogPost(){
    const mount = $('#postMount');
    if (!mount) return;
    const params = new URLSearchParams(location.search);
    const slug = params.get('s') || '';
    const local = params.get('local') === '1';
    const notice = $('#postNotice');

    if (!slug){
      mount.innerHTML = '<div class="empty-state">Missing post slug.</div>';
      return;
    }

    let post = null;
    try {
      if (local && slug === 'welcome') {
        post = {
          title: 'Field Notes: Welcome to the SOL Growth Platform',
          published_at: new Date().toISOString(),
          author: 'Skyes Over London LC',
          content_md: [
            '## What you are looking at',
            '',
            'This site now supports:',
            '- Blog publishing (CMS) backed by Netlify Blobs',
            '- Gated Client Vault content (Identity + Functions)',
            '- Portal Status + Monitoring dashboard',
            '',
            'Right now you are viewing a built-in fallback post because Functions were not detected during load.',
            '',
            '## Turn on the “real” platform',
            '',
            'Deploy with Netlify CLI (no Git required), enable Netlify Identity, and set your admin emails.',
            '',
            'Once that is done, open **Admin** to publish posts and manage portals.'
          ].join('\n'),
          tags: ['Ops','Platform']
        };
      } else {
        const data = await jsonFetch(`${state.apiBase}/blog-get?slug=${encodeURIComponent(slug)}`);
        post = data.post;
      }
    } catch (e){
      if (notice) {
        notice.style.display = 'block';
        notice.innerHTML = 'This post could not be loaded. If you expected it to exist, deploy Functions (Netlify CLI/Git).';
      }
      mount.innerHTML = '<div class="empty-state">Post unavailable.</div>';
      return;
    }

    $('#postTitle') && ($('#postTitle').textContent = post.title || '');
    $('#postMeta') && ($('#postMeta').textContent = `${fmtDate(post.published_at)} · ${post.author || 'Skyes Over London LC'}`);

    mount.innerHTML = miniMarkdown(post.content_md || '');
  }

  // ─────────────────────────────────────────────
  // Status (public) + Dashboard (gated-ish)
  // ─────────────────────────────────────────────
  async function renderStatus(){
    const mount = $('#statusMount');
    if (!mount) return;
    const notice = $('#statusNotice');

    mount.innerHTML = '<div class="loading">Checking portals…</div>';
    try {
      const data = await jsonFetch(`${state.apiBase}/portal-status`);
      const rows = (data.results || []).map(r => {
        const ok = r.ok ? 'ok' : 'bad';
        const badge = r.ok ? 'OK' : (r.status ? `HTTP ${r.status}` : 'DOWN');
        const ms = (typeof r.ms === 'number') ? `${Math.round(r.ms)} ms` : '—';
        const err = r.error ? `<div class="small-dim">${esc(r.error)}</div>` : '';
        return `
          <div class="status-row ${ok}">
            <div>
              <div class="status-name">${esc(r.name || r.url)}</div>
              <div class="status-url">${esc(r.url)}</div>
              ${err}
            </div>
            <div class="status-right">
              <span class="status-badge ${ok}">${esc(badge)}</span>
              <div class="status-ms">${esc(ms)}</div>
              <a class="status-link" href="${esc(r.url)}" target="_blank" rel="noopener">Open →</a>
            </div>
          </div>
        `;
      }).join('');

      const at = data.checked_at ? fmtDate(data.checked_at) + ' ' + new Date(data.checked_at).toLocaleTimeString() : '';
      $('#statusAt') && ($('#statusAt').textContent = at ? `Last check: ${at}` : '');
      mount.innerHTML = rows || '<div class="empty-state">No portals configured yet.</div>';
    } catch (e){
      if (notice) {
        notice.style.display = 'block';
        notice.innerHTML = 'Status is in <strong>read-only mode</strong>. Deploy Functions (Netlify CLI/Git) to enable live checks.';
      }
      mount.innerHTML = '<div class="empty-state">Live status unavailable.</div>';
    }
  }

  async function renderDashboard(){
    const mount = $('#dashMount');
    if (!mount) return;
    const notice = $('#dashNotice');
    mount.innerHTML = '<div class="loading">Loading dashboard…</div>';

    try {
      const data = await jsonFetch(`${state.apiBase}/portal-status`);
      const up = (data.results||[]).filter(r=>r.ok).length;
      const total = (data.results||[]).length;
      $('#dashKpi') && ($('#dashKpi').textContent = total ? `${up}/${total} UP` : '—');
      mount.innerHTML = (data.results||[]).map(r => {
        const ok = r.ok ? 'ok' : 'bad';
        const ms = (typeof r.ms === 'number') ? `${Math.round(r.ms)} ms` : '—';
        return `
          <div class="dash-card ${ok}">
            <div class="dash-title">${esc(r.name || r.url)}</div>
            <div class="dash-sub">${esc(r.url)}</div>
            <div class="dash-metrics">
              <div class="dash-metric"><span class="k">Status</span><span class="v">${r.ok ? 'OK' : (r.status ? `HTTP ${r.status}` : 'DOWN')}</span></div>
              <div class="dash-metric"><span class="k">Latency</span><span class="v">${esc(ms)}</span></div>
            </div>
          </div>
        `;
      }).join('') || '<div class="empty-state">No portals configured.</div>';

    } catch (e){
      if (notice) {
        notice.style.display = 'block';
        notice.innerHTML = 'Dashboard needs Functions + a portal list. Deploy with Netlify CLI and configure portals in Admin.';
      }
      mount.innerHTML = '<div class="empty-state">Dashboard unavailable.</div>';
    }
  }

  // ─────────────────────────────────────────────
  // Admin console
  // ─────────────────────────────────────────────
  async function initAdmin(){
    const root = $('#adminApp');
    if (!root) return;

    const gate = $('#adminGate');
    const app = $('#adminMain');
    const msg = $('#adminMsg');

    async function ensure(){
      if (!state.identityReady) {
        gate.style.display = 'block';
        app.style.display = 'none';
        msg.innerHTML = 'Netlify Identity is not enabled yet. Enable it in your Netlify site settings to use Admin.';
        return;
      }

      const u = window.netlifyIdentity.currentUser();
      if (!u){
        gate.style.display = 'block';
        app.style.display = 'none';
        msg.innerHTML = 'Sign in to manage blog posts, vault content, and portal monitoring.';
        return;
      }

      // Check admin permissions by calling the server
      try {
        const token = await getToken();
        await jsonFetch(`${state.apiBase}/admin-whoami`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        gate.style.display = 'none';
        app.style.display = 'block';
        await renderAdminPosts();
        await renderAdminPortals();
        await renderAdminVault();
      } catch (e){
        gate.style.display = 'block';
        app.style.display = 'none';
        msg.innerHTML = `Access denied. Your account is not an admin for this site.`;
      }
    }

    $('#adminLogin')?.addEventListener('click', () => window.netlifyIdentity.open('login'));
    $('#adminLogout')?.addEventListener('click', () => window.netlifyIdentity.logout());
    window.netlifyIdentity.on('login', ensure);
    window.netlifyIdentity.on('logout', ensure);

    // Tabs
    $$('.tab-btn').forEach(btn => btn.addEventListener('click', () => {
      $$('.tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const tab = btn.getAttribute('data-tab');
      $$('.tab-panel').forEach(p => p.style.display = (p.getAttribute('data-tab') === tab ? 'block' : 'none'));
    }));

    // Blog editor
    $('#postSave')?.addEventListener('click', async () => {
      const token = await getToken();
      const post = collectPostForm();
      await jsonFetch(`${state.apiBase}/blog-upsert`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ post })
      });
      toast('Saved post.');
      clearPostForm();
      await renderAdminPosts();
    });
    $('#postDelete')?.addEventListener('click', async () => {
      const slug = ($('#postSlug')?.value || '').trim();
      if (!slug) return toast('No slug selected.', true);
      const token = await getToken();
      await jsonFetch(`${state.apiBase}/blog-delete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ slug })
      });
      toast('Deleted post.');
      clearPostForm();
      await renderAdminPosts();
    });
    $('#postNew')?.addEventListener('click', () => { clearPostForm(); toast('New draft ready.'); });

    // Portal editor
    $('#portalSave')?.addEventListener('click', async () => {
      const token = await getToken();
      const portal = collectPortalForm();
      await jsonFetch(`${state.apiBase}/portals-upsert`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ portal })
      });
      toast('Saved portal.');
      clearPortalForm();
      await renderAdminPortals();
    });
    $('#portalDelete')?.addEventListener('click', async () => {
      const id = ($('#portalId')?.value || '').trim();
      if (!id) return toast('No portal selected.', true);
      const token = await getToken();
      await jsonFetch(`${state.apiBase}/portals-delete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ id })
      });
      toast('Deleted portal.');
      clearPortalForm();
      await renderAdminPortals();
    });
    $('#portalNew')?.addEventListener('click', () => { clearPortalForm(); toast('New portal ready.'); });

    // Vault editor
    $('#vaultSave')?.addEventListener('click', async () => {
      const token = await getToken();
      const doc = collectVaultForm();
      await jsonFetch(`${state.apiBase}/vault-upsert`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ doc })
      });
      toast('Saved vault document.');
      clearVaultForm();
      await renderAdminVault();
    });
    $('#vaultDelete')?.addEventListener('click', async () => {
      const id = ($('#vaultId')?.value || '').trim();
      if (!id) return toast('No document selected.', true);
      const token = await getToken();
      await jsonFetch(`${state.apiBase}/vault-delete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ id })
      });
      toast('Deleted vault document.');
      clearVaultForm();
      await renderAdminVault();
    });
    $('#vaultNew')?.addEventListener('click', () => { clearVaultForm(); toast('New vault document ready.'); });

    // Monitoring
    $('#runCheck')?.addEventListener('click', async () => {
      const data = await jsonFetch(`${state.apiBase}/portal-status?refresh=1`);
      const up = (data.results||[]).filter(r=>r.ok).length;
      const total = (data.results||[]).length;
      $('#monKpi') && ($('#monKpi').textContent = total ? `${up}/${total} UP` : '—');
      $('#monOut') && ($('#monOut').innerHTML = (data.results||[]).map(r => {
        const ok = r.ok ? 'ok' : 'bad';
        const ms = (typeof r.ms === 'number') ? `${Math.round(r.ms)} ms` : '—';
        return `<div class="mon-row ${ok}"><span>${esc(r.name || r.url)}</span><span class="right">${r.ok ? 'OK' : (r.status ? `HTTP ${r.status}` : 'DOWN')} · ${esc(ms)}</span></div>`;
      }).join('') || '<div class="empty-state">No portals configured.</div>');
    });

    await ensure();

    function collectPostForm(){
      const slugRaw = ($('#postSlug')?.value || '').trim();
      const title = ($('#postTitleIn')?.value || '').trim();
      const slug = slugRaw || slugify(title || `post-${Date.now()}`);
      return {
        slug,
        title,
        excerpt: ($('#postExcerpt')?.value || '').trim(),
        cover_image: ($('#postCover')?.value || '').trim() || null,
        tags: ($('#postTags')?.value || '').split(',').map(s=>s.trim()).filter(Boolean),
        status: ($('#postStatus')?.value || 'draft').trim(),
        content_md: ($('#postBody')?.value || '').trim(),
      };
    }
    function clearPostForm(){
      ['postSlug','postTitleIn','postExcerpt','postCover','postTags','postBody'].forEach(id => { const el = $('#'+id); if (el) el.value=''; });
      $('#postStatus') && ($('#postStatus').value='draft');
    }

    function collectPortalForm(){
      const idRaw = ($('#portalId')?.value || '').trim();
      const name = ($('#portalName')?.value || '').trim();
      const id = idRaw || slugify(name || `portal-${Date.now()}`);
      const url = ($('#portalUrl')?.value || '').trim();
      const path = ($('#portalPath')?.value || '').trim() || '/';
      return {
        id,
        name,
        url,
        path,
        category: ($('#portalCategory')?.value || '').trim() || null,
        public: ($('#portalPublic')?.checked) ? true : false,
        notes: ($('#portalNotes')?.value || '').trim() || null,
      };
    }
    function clearPortalForm(){
      ['portalId','portalName','portalUrl','portalPath','portalCategory','portalNotes'].forEach(id => { const el = $('#'+id); if (el) el.value=''; });
      $('#portalPublic') && ($('#portalPublic').checked = true);
    }

    function collectVaultForm(){
      const idRaw = ($('#vaultId')?.value || '').trim();
      const title = ($('#vaultTitle')?.value || '').trim();
      const id = idRaw || slugify(title || `doc-${Date.now()}`);
      return {
        id,
        title,
        audience: ($('#vaultAudience')?.value || 'clients').trim(),
        tags: ($('#vaultTags')?.value || '').split(',').map(s=>s.trim()).filter(Boolean),
        content_md: ($('#vaultBody')?.value || '').trim(),
      };
    }
    function clearVaultForm(){
      ['vaultId','vaultTitle','vaultTags','vaultBody'].forEach(id => { const el = $('#'+id); if (el) el.value=''; });
      $('#vaultAudience') && ($('#vaultAudience').value='clients');
    }

    async function renderAdminPosts(){
      const token = await getToken();
      const data = await jsonFetch(`${state.apiBase}/blog-list?status=all`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const list = $('#adminPostList');
      if (!list) return;
      list.innerHTML = (data.posts||[]).sort((a,b)=>new Date(b.published_at||0)-new Date(a.published_at||0)).map(p => {
        const s = p.status === 'published' ? 'pub' : 'draft';
        return `<button class="list-item" data-slug="${esc(p.slug)}"><span class="pill ${s}">${esc(p.status||'draft')}</span> ${esc(p.title||p.slug)} <span class="dim">· ${esc(fmtDate(p.published_at))}</span></button>`;
      }).join('') || '<div class="empty-state">No posts yet.</div>';

      $$('.list-item', list).forEach(btn => btn.addEventListener('click', async () => {
        const slug = btn.getAttribute('data-slug');
        const postData = await jsonFetch(`${state.apiBase}/blog-get?slug=${encodeURIComponent(slug)}&status=all`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const p = postData.post;
        $('#postSlug').value = p.slug || '';
        $('#postTitleIn').value = p.title || '';
        $('#postExcerpt').value = p.excerpt || '';
        $('#postCover').value = p.cover_image || '';
        $('#postTags').value = (p.tags||[]).join(', ');
        $('#postStatus').value = p.status || 'draft';
        $('#postBody').value = p.content_md || '';
        toast('Loaded post.');
      }));
    }

    async function renderAdminPortals(){
      const token = await getToken();
      const data = await jsonFetch(`${state.apiBase}/portals-list?scope=all`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const list = $('#adminPortalList');
      if (!list) return;
      list.innerHTML = (data.portals||[]).map(p => {
        const s = p.public ? 'pub' : 'draft';
        return `<button class="list-item" data-id="${esc(p.id)}"><span class="pill ${s}">${p.public ? 'public' : 'private'}</span> ${esc(p.name||p.id)} <span class="dim">· ${esc(p.url||'')}</span></button>`;
      }).join('') || '<div class="empty-state">No portals configured.</div>';

      $$('.list-item', list).forEach(btn => btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        const p = (data.portals||[]).find(x => x.id === id);
        if (!p) return;
        $('#portalId').value = p.id || '';
        $('#portalName').value = p.name || '';
        $('#portalUrl').value = p.url || '';
        $('#portalPath').value = p.path || '/';
        $('#portalCategory').value = p.category || '';
        $('#portalPublic').checked = !!p.public;
        $('#portalNotes').value = p.notes || '';
        toast('Loaded portal.');
      }));
    }

    async function renderAdminVault(){
      const token = await getToken();
      const data = await jsonFetch(`${state.apiBase}/vault-list?scope=all`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const list = $('#adminVaultList');
      if (!list) return;
      list.innerHTML = (data.docs||[]).map(d => {
        return `<button class="list-item" data-id="${esc(d.id)}"><span class="pill pub">${esc(d.audience||'clients')}</span> ${esc(d.title||d.id)} <span class="dim">· ${(d.tags||[]).slice(0,2).map(esc).join(', ')}</span></button>`;
      }).join('') || '<div class="empty-state">No vault documents.</div>';

      $$('.list-item', list).forEach(btn => btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-id');
        const docData = await jsonFetch(`${state.apiBase}/vault-get?id=${encodeURIComponent(id)}&scope=all`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const d = docData.doc;
        $('#vaultId').value = d.id || '';
        $('#vaultTitle').value = d.title || '';
        $('#vaultAudience').value = d.audience || 'clients';
        $('#vaultTags').value = (d.tags||[]).join(', ');
        $('#vaultBody').value = d.content_md || '';
        toast('Loaded vault document.');
      }));
    }

    function slugify(s){
      return String(s||'')
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g,'')
        .trim()
        .replace(/\s+/g,'-')
        .replace(/-+/g,'-')
        .slice(0,80) || `item-${Date.now()}`;
    }

    function toast(text, isErr=false){
      const t = $('#toast');
      if (!t) return;
      t.textContent = text;
      t.classList.toggle('err', !!isErr);
      t.classList.add('show');
      setTimeout(()=>t.classList.remove('show'), 2200);
    }
  }

  // ─────────────────────────────────────────────
  // Vault (client gated)
  // ─────────────────────────────────────────────
  async function initVault(){
    const mount = $('#vaultMount');
    if (!mount) return;

    const gate = $('#vaultGate');
    const list = $('#vaultList');
    const viewer = $('#vaultViewer');
    const msg = $('#vaultMsg');

    async function ensure(){
      if (!state.identityReady) {
        gate.style.display = 'block';
        mount.style.display = 'none';
        msg.innerHTML = 'Netlify Identity is not enabled yet. Enable it to use the Client Vault.';
        return;
      }

      const u = window.netlifyIdentity.currentUser();
      if (!u){
        gate.style.display = 'block';
        mount.style.display = 'none';
        msg.innerHTML = 'Sign in to access gated content.';
        return;
      }

      try {
        const token = await getToken();
        const data = await jsonFetch(`${state.apiBase}/vault-list`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        gate.style.display = 'none';
        mount.style.display = 'block';
        list.innerHTML = (data.docs||[]).map(d => `<button class="list-item" data-id="${esc(d.id)}">${esc(d.title || d.id)}</button>`).join('') || '<div class="empty-state">No documents yet.</div>';
        $$('.list-item', list).forEach(btn => btn.addEventListener('click', async () => {
          const id = btn.getAttribute('data-id');
          const docData = await jsonFetch(`${state.apiBase}/vault-get?id=${encodeURIComponent(id)}`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          const d = docData.doc;
          $('#vaultTitleOut') && ($('#vaultTitleOut').textContent = d.title || '');
          viewer.innerHTML = miniMarkdown(d.content_md || '');
        }));
      } catch (e){
        gate.style.display = 'block';
        mount.style.display = 'none';
        msg.innerHTML = 'Vault unavailable. Deploy Functions + Blobs and ensure your account is active.';
      }
    }

    $('#vaultLogin')?.addEventListener('click', () => window.netlifyIdentity.open('login'));
    $('#vaultLogout')?.addEventListener('click', () => window.netlifyIdentity.logout());
    window.netlifyIdentity.on('login', ensure);
    window.netlifyIdentity.on('logout', ensure);
    await ensure();
  }

  // ─────────────────────────────────────────────
  // Boot
  // ─────────────────────────────────────────────
  function boot(){
    // Identity script loads async; poll a little.
    const tries = 30;
    let n = 0;
    const t = setInterval(() => {
      n++;
      if (window.netlifyIdentity){
        clearInterval(t);
        initIdentity();
      }
      if (n >= tries) clearInterval(t);
    }, 120);

    renderBlogList();
    renderBlogPost();
    renderStatus();
    renderDashboard();
    initAdmin();
    initVault();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
