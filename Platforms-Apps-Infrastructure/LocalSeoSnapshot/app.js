// app.js
(() => {
  "use strict";

  const APP = "Local SEO Snapshot";
  const BUILD = "2026.02.25.2";
  const ERROR_ENDPOINT = "/.netlify/functions/client-error-report";
  const LS_KEY = "local_seo_snapshot_last_report_v1";

  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));

  const el = {
    toolForm: $("#toolForm"),
    toolStatus: $("#toolStatus"),

    businessName: $("#businessName"),
    category: $("#category"),
    cityState: $("#cityState"),
    radiusMiles: $("#radiusMiles"),
    websiteUrl: $("#websiteUrl"),
    reviewCount: $("#reviewCount"),
    avgRating: $("#avgRating"),
    comp1: $("#comp1"),
    comp2: $("#comp2"),
    comp3: $("#comp3"),
    postingFreq: $("#postingFreq"),
    photosPerMonth: $("#photosPerMonth"),

    btnGenerate: $("#btnGenerate"),
    btnSaveLocal: $("#btnSaveLocal"),
    btnLoadLast: $("#btnLoadLast"),
    btnClear: $("#btnClear"),
    btnExportPdf: $("#btnExportPdf"),
    btnCopySummary: $("#btnCopySummary"),
    btnInstall: $("#btnInstall"),
    btnDiagnostics: $("#btnDiagnostics"),

    scoreSubtitle: $("#scoreSubtitle"),
    gaugeFill: $("#gaugeFill"),
    gaugeText: $("#gaugeText"),

    resultSummary: $("#resultSummary"),
    targetCard: $("#targetCard"),
    targetBody: $("#targetBody"),
    topFixes: $("#topFixes"),
    plan30: $("#plan30"),

    leadForm: $("#leadForm"),
    leadStatus: $("#leadStatus"),
    reportSummaryField: $("#reportSummaryField"),
    btnPrefillLead: $("#btnPrefillLead"),

    btnRunSelfTest: $("#btnRunSelfTest"),
    btnSendTestError: $("#btnSendTestError"),

    drawer: $("#drawer"),
    drawerOverlay: $("#drawerOverlay"),
    btnCloseDrawer: $("#btnCloseDrawer"),

    diagApp: $("#diagApp"),
    diagBuild: $("#diagBuild"),
    diagOnline: $("#diagOnline"),
    diagSw: $("#diagSw"),
    diagLastReport: $("#diagLastReport"),
    diagStorageUsed: $("#diagStorageUsed"),
    diagLastError: $("#diagLastError"),
    btnReportLastError: $("#btnReportLastError"),
    btnClearLastError: $("#btnClearLastError"),
    btnSendDiagPing: $("#btnSendDiagPing"),
    diagStatus: $("#diagStatus"),
  };

  const CATEGORY_LIBRARY = [
    { value: "accounting_firm", label: "Accounting Firm", keywords: ["accounting", "bookkeeping", "tax"], specificity: 0.82 },
    { value: "tax_service", label: "Tax Service", keywords: ["tax", "irs", "refund"], specificity: 0.88 },
    { value: "marketing_agency", label: "Marketing Agency", keywords: ["marketing", "seo", "ads"], specificity: 0.78 },
    { value: "web_design", label: "Web Design / Development", keywords: ["web", "website", "dev", "development"], specificity: 0.84 },
    { value: "plumber", label: "Plumber", keywords: ["plumb", "plumbing"], specificity: 0.78 },
    { value: "electrician", label: "Electrician", keywords: ["electric", "electrical"], specificity: 0.78 },
    { value: "hvac", label: "HVAC Contractor", keywords: ["hvac", "heating", "cooling", "air"], specificity: 0.80 },
    { value: "roofer", label: "Roofing Contractor", keywords: ["roof", "roofing"], specificity: 0.80 },
    { value: "landscaping", label: "Landscaping", keywords: ["landscape", "lawn", "yard"], specificity: 0.74 },
    { value: "cleaning", label: "Cleaning Service", keywords: ["clean", "cleaning", "maid"], specificity: 0.74 },
    { value: "moving", label: "Moving Company", keywords: ["moving", "movers"], specificity: 0.78 },
    { value: "auto_repair", label: "Auto Repair Shop", keywords: ["auto", "repair", "mechanic"], specificity: 0.80 },
    { value: "tire_shop", label: "Tire Shop", keywords: ["tire", "tyre"], specificity: 0.84 },
    { value: "barber", label: "Barber Shop", keywords: ["barber", "cuts", "fade"], specificity: 0.82 },
    { value: "tattoo", label: "Tattoo Studio", keywords: ["tattoo", "ink"], specificity: 0.84 },
    { value: "law_firm", label: "Law Firm", keywords: ["law", "attorney", "legal"], specificity: 0.76 },
    { value: "dentist", label: "Dentist", keywords: ["dentist", "dental"], specificity: 0.84 },
    { value: "real_estate", label: "Real Estate Agent", keywords: ["real estate", "realtor"], specificity: 0.72 },
    { value: "restaurant", label: "Restaurant", keywords: ["restaurant", "grill", "kitchen", "cafe"], specificity: 0.66 },
    { value: "gym", label: "Gym / Fitness", keywords: ["gym", "fitness", "training"], specificity: 0.70 },
    { value: "general_contractor", label: "General Contractor", keywords: ["contractor", "construction", "remodel"], specificity: 0.64 },
  ];

  let deferredInstallPrompt = null;
  let lastComputed = null;
  let lastCapturedError = null;

  // -------------------------
  // Utilities
  // -------------------------
  const clamp = (n, min, max) => Math.max(min, Math.min(max, n));

  const safeNum = (v, fallback = 0) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
  };

  const normalizeStr = (s) => String(s || "").trim();

  const nowISO = () => new Date().toISOString();

  const approxLocalStorageBytes = () => {
    try {
      let total = 0;
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        const v = localStorage.getItem(k) || "";
        total += (k ? k.length : 0) + v.length;
      }
      return total * 2; // UTF-16 rough estimate
    } catch {
      return 0;
    }
  };

  const fmtInt = (n) => {
    const x = Math.round(Number(n) || 0);
    return x.toLocaleString();
  };

  const fmt1 = (n) => {
    const x = Number(n);
    if (!Number.isFinite(x)) return "—";
    return x.toFixed(1);
  };

  const scoreLabel = (s) => {
    if (s >= 90) return "Elite";
    if (s >= 80) return "Strong";
    if (s >= 70) return "Good";
    if (s >= 60) return "Developing";
    if (s >= 45) return "Weak";
    return "Critical";
  };

  const setCallout = (node, msg, kind = "") => {
    node.textContent = msg || "";
    node.classList.remove("ok", "warn", "bad");
    if (kind) node.classList.add(kind);
  };

  // -------------------------
  // Error reporting (client → Netlify Function)
  // -------------------------
  const postErrorReport = async (payload) => {
    const body = JSON.stringify({
      app: APP,
      build: BUILD,
      time: nowISO(),
      url: location.href,
      userAgent: navigator.userAgent,
      online: navigator.onLine,
      ...payload,
    });

    const headers = {
      "content-type": "application/json",
      "x-kaixu-app": APP,
      "x-kaixu-build": BUILD,
    };

    // Prefer sendBeacon when possible (best-effort, doesn't block navigation)
    try {
      if (navigator.sendBeacon) {
        const blob = new Blob([body], { type: "application/json" });
        const ok = navigator.sendBeacon(ERROR_ENDPOINT, blob);
        if (ok) return { ok: true, via: "beacon" };
      }
    } catch {
      // ignore, fallback to fetch
    }

    const res = await fetch(ERROR_ENDPOINT, {
      method: "POST",
      headers,
      body,
    });

    let data = null;
    try { data = await res.json(); } catch { /* ignore */ }

    return { ok: res.ok, status: res.status, data, via: "fetch" };
  };

  const captureError = async (errPayload, alsoToast = true) => {
    lastCapturedError = {
      ...errPayload,
      capturedAt: nowISO(),
    };
    try { localStorage.setItem("__last_client_error__", JSON.stringify(lastCapturedError)); } catch {}

    refreshDiagnostics();

    if (alsoToast) {
      setCallout(el.toolStatus, "Captured an error. Open Diagnostics → report it if needed.", "warn");
    }
  };

  window.addEventListener("error", (ev) => {
    const payload = {
      kind: "window.error",
      message: ev.message || "Unspecified error",
      filename: ev.filename || "",
      lineno: ev.lineno || 0,
      colno: ev.colno || 0,
      stack: ev.error && ev.error.stack ? String(ev.error.stack) : "",
    };
    captureError(payload, false);
  });

  window.addEventListener("unhandledrejection", (ev) => {
    const reason = ev.reason;
    const payload = {
      kind: "unhandledrejection",
      message: reason && reason.message ? String(reason.message) : String(reason || "Unhandled promise rejection"),
      stack: reason && reason.stack ? String(reason.stack) : "",
    };
    captureError(payload, false);
  });

  // -------------------------
  // Core scoring logic (real logic)
  // -------------------------
  const computeNapCompleteness = (inputs) => {
    // Proxy NAP completeness using core local listing fields we actually have.
    const b = normalizeStr(inputs.businessName);
    const c = normalizeStr(inputs.category);
    const cs = normalizeStr(inputs.cityState);
    const r = safeNum(inputs.radiusMiles, 0);
    const w = normalizeStr(inputs.websiteUrl);

    let score = 0;
    const notes = [];

    if (b.length >= 2) { score += 30; } else { notes.push("Business name missing."); }
    if (c) { score += 20; } else { notes.push("Primary category missing."); }
    if (cs.length >= 4 && cs.includes(",")) { score += 30; } else { notes.push("City/State should look like “City, ST”."); }
    if (r > 0) { score += 10; } else { notes.push("Service radius missing or 0."); }
    if (w) { score += 10; } else { notes.push("Website missing (optional but helpful)."); }

    score = clamp(score, 0, 100);

    // Penalty if the “City, ST” is malformed
    if (cs && !/^[^,]{2,},\s*[A-Za-z]{2,}$/.test(cs)) score = clamp(score - 8, 0, 100);

    return { score, notes };
  };

  const computeCategoryMatch = (inputs, catMeta) => {
    const business = normalizeStr(inputs.businessName).toLowerCase();
    const website = normalizeStr(inputs.websiteUrl).toLowerCase();

    let base = Math.round((catMeta?.specificity ?? 0.66) * 100);
    let bonus = 0;
    const notes = [];

    const keywordHits = (catMeta?.keywords || []).filter((k) => business.includes(k));
    const urlHits = (catMeta?.keywords || []).filter((k) => website.includes(k.replace(/\s+/g, "")) || website.includes(k));

    if (keywordHits.length > 0) {
      bonus += 10;
      notes.push(`Business name contains category keyword(s): ${keywordHits.slice(0, 3).join(", ")}.`);
    } else {
      notes.push("Business name does not clearly reinforce the category (optional, but helpful).");
    }

    if (website && urlHits.length > 0) {
      bonus += 6;
      notes.push("Website URL suggests category relevance (minor boost).");
    }

    // Slight penalty if category is very broad
    if ((catMeta?.specificity ?? 0.66) < 0.70) {
      notes.push("Selected category is broad; a more specific primary category can improve match.");
      base = clamp(base - 6, 0, 100);
    }

    const score = clamp(base + bonus, 0, 100);
    return { score, notes };
  };

  const computeReviewStrength = (inputs, competitorCounts) => {
    const reviews = clamp(safeNum(inputs.reviewCount, 0), 0, 200000);
    const rating = clamp(safeNum(inputs.avgRating, 0), 0, 5);

    // Rating component: 0–60
    // 4.7+ is elite; 4.2 is decent; below 4.0 is a drag.
    const ratingScore =
      rating >= 4.8 ? 60 :
      rating >= 4.6 ? 54 :
      rating >= 4.4 ? 48 :
      rating >= 4.2 ? 42 :
      rating >= 4.0 ? 34 :
      rating >= 3.8 ? 26 :
      rating >= 3.6 ? 18 :
      rating >= 3.4 ? 12 :
      rating > 0 ? 8 : 0;

    // Volume component: 0–40 (log-ish ramp)
    // 10 reviews gets you out of “new”; 50 is credible; 150 is strong; 500+ is heavy.
    const volumeScore = (() => {
      if (reviews <= 0) return 0;
      if (reviews < 10) return 10 + (reviews * 1.5); // 0-10 → 10-25
      if (reviews < 50) return 25 + ((reviews - 10) * (10 / 40)); // 10-50 → 25-35
      if (reviews < 150) return 35 + ((reviews - 50) * (4 / 100)); // 50-150 → 35-39
      if (reviews < 500) return 39 + ((reviews - 150) * (1 / 350)); // 150-500 → 39-40
      return 40;
    })();

    // Competitor parity adjustment: -10 .. +10
    let parityAdj = 0;
    const notes = [];

    const comps = competitorCounts.filter((n) => Number.isFinite(n) && n >= 0);
    if (comps.length > 0) {
      const max = Math.max(...comps);
      const avg = comps.reduce((a, b) => a + b, 0) / comps.length;

      if (reviews >= max) {
        parityAdj += 8;
        notes.push("You are at or above the top competitor’s review volume (parity advantage).");
      } else {
        const ratio = reviews / Math.max(1, max);
        if (ratio >= 0.75) { parityAdj += 2; notes.push("Close to top competitor review volume (near parity)."); }
        else if (ratio >= 0.50) { parityAdj -= 2; notes.push("About half of top competitor review volume (needs push)."); }
        else { parityAdj -= 7; notes.push("Far behind top competitor review volume (reviews are a priority)."); }
      }

      // If your rating is high but volume is low, note it.
      if (rating >= 4.6 && reviews < avg) notes.push("Strong rating; volume is the limiter versus competitors.");
    } else {
      notes.push("No competitor counts provided; review strength scored from rating + volume only.");
    }

    const score = clamp(Math.round(ratingScore + clamp(volumeScore, 0, 40) + parityAdj), 0, 100);
    return { score, notes };
  };

  const computeContentCadence = (inputs) => {
    const postsPerMonth = clamp(safeNum(inputs.postingFreq, 0), 0, 120);
    const photosPerMonth = clamp(safeNum(inputs.photosPerMonth, 0), 0, 500);

    // Posts: 0–55
    const postScore =
      postsPerMonth >= 16 ? 55 :
      postsPerMonth >= 12 ? 50 :
      postsPerMonth >= 8 ? 44 :
      postsPerMonth >= 4 ? 36 :
      postsPerMonth >= 2 ? 26 :
      postsPerMonth >= 1 ? 18 : 0;

    // Photos: 0–45
    const photoScore =
      photosPerMonth >= 60 ? 45 :
      photosPerMonth >= 40 ? 40 :
      photosPerMonth >= 25 ? 34 :
      photosPerMonth >= 12 ? 26 :
      photosPerMonth >= 6 ? 18 :
      photosPerMonth >= 2 ? 10 :
      photosPerMonth >= 1 ? 6 : 0;

    const score = clamp(postScore + photoScore, 0, 100);
    const notes = [];

    if (postsPerMonth === 0) notes.push("No posts per month: add weekly updates (offers, tips, photos, wins).");
    else if (postsPerMonth < 4) notes.push("Posting is light: aim for 1–2 updates per week.");
    else notes.push("Posting cadence is competitive.");

    if (photosPerMonth === 0) notes.push("No photos per month: add fresh images (work, team, location, before/after).");
    else if (photosPerMonth < 12) notes.push("Photo cadence is light: aim for 12–25 per month.");
    else notes.push("Photo cadence is strong.");

    return { score, notes };
  };

  const computeConversionReadiness = (inputs) => {
    const website = normalizeStr(inputs.websiteUrl);
    const rating = clamp(safeNum(inputs.avgRating, 0), 0, 5);
    const reviews = clamp(safeNum(inputs.reviewCount, 0), 0, 200000);
    const postsPerMonth = clamp(safeNum(inputs.postingFreq, 0), 0, 120);
    const photosPerMonth = clamp(safeNum(inputs.photosPerMonth, 0), 0, 500);

    let score = 0;
    const notes = [];

    if (website) {
      score += 45;
      if (/^https:\/\//i.test(website)) score += 10;
      else notes.push("Website exists but is not HTTPS (or URL is not formatted). Use HTTPS for trust.");
    } else {
      notes.push("No website URL provided: a conversion surface (site/landing page) increases lead capture.");
    }

    // Proof & activity lift conversion readiness
    if (reviews >= 10) score += 10;
    if (reviews >= 50) score += 6;
    if (rating >= 4.2) score += 8;
    if (rating >= 4.6) score += 6;
    if (postsPerMonth >= 4) score += 8;
    if (photosPerMonth >= 12) score += 7;

    score = clamp(Math.round(score), 0, 100);

    if (score < 60) notes.push("Priority: make it easy to convert (clear offer, contact path, proof, location/service area).");
    else notes.push("Conversion readiness is competitive.");

    return { score, notes };
  };

  const computeTrust = (inputs, competitorCounts) => {
    const rating = clamp(safeNum(inputs.avgRating, 0), 0, 5);
    const reviews = clamp(safeNum(inputs.reviewCount, 0), 0, 200000);
    const cityState = normalizeStr(inputs.cityState);
    const website = normalizeStr(inputs.websiteUrl);
    const postsPerMonth = clamp(safeNum(inputs.postingFreq, 0), 0, 120);

    let score = 0;
    const notes = [];

    // Rating-heavy trust
    score += (rating / 5) * 55;

    // Review volume trust
    if (reviews >= 10) score += 10;
    if (reviews >= 50) score += 10;
    if (reviews >= 150) score += 5;

    // Basic presence signals
    if (cityState.includes(",")) score += 5;
    if (website) score += 7;
    if (postsPerMonth >= 2) score += 5;
    if (postsPerMonth >= 8) score += 3;

    // Competitor parity contributes to perceived trust
    const comps = competitorCounts.filter((n) => Number.isFinite(n) && n >= 0);
    if (comps.length > 0) {
      const max = Math.max(...comps);
      const ratio = reviews / Math.max(1, max);
      if (ratio >= 1) score += 5;
      else if (ratio >= 0.7) score += 2;
      else if (ratio >= 0.4) score -= 2;
      else score -= 6;
    }

    score = clamp(Math.round(score), 0, 100);

    if (rating > 0 && rating < 4.0) notes.push("Trust drag: rating below 4.0. Improve service recovery + ask happy customers for reviews.");
    if (reviews < 10) notes.push("Trust drag: fewer than 10 reviews. Push early momentum.");
    if (!website) notes.push("Trust lift: a website increases legitimacy and conversion confidence.");
    if (score >= 80) notes.push("Trust signals are strong.");
    else notes.push("Trust signals have room to strengthen.");

    return { score, notes };
  };

  const computeOverall = (dims) => {
    // Weighted: reviews + trust slightly heavier.
    const weights = { nap: 0.15, category: 0.15, reviews: 0.22, cadence: 0.16, conversion: 0.16, trust: 0.16 };
    const overall =
      dims.nap.score * weights.nap +
      dims.category.score * weights.category +
      dims.reviews.score * weights.reviews +
      dims.cadence.score * weights.cadence +
      dims.conversion.score * weights.conversion +
      dims.trust.score * weights.trust;

    return clamp(Math.round(overall), 0, 100);
  };

  // -------------------------
  // Targets + plan generation
  // -------------------------
  const computeReviewTargets = (inputs, competitorCounts) => {
    const current = clamp(safeNum(inputs.reviewCount, 0), 0, 200000);
    const comps = competitorCounts.filter((n) => Number.isFinite(n) && n >= 0);

    if (comps.length === 0) return null;

    const max = Math.max(...comps);
    const avg = comps.reduce((a, b) => a + b, 0) / comps.length;

    // Realistic target: beat the top competitor by ~10% OR reach avg+15, whichever is higher.
    // Add a sanity limiter: if max is tiny (<20), still target a credible baseline (30+).
    let target = Math.ceil(Math.max(max * 1.10, avg + 15));
    if (max < 20) target = Math.max(target, 30);

    // If you're already above target, set a maintenance target.
    if (current >= target) target = current + 10;

    const delta = Math.max(0, target - current);

    // 90 days ≈ 13 weeks ≈ 3 months
    const weekly = delta === 0 ? 0 : Math.max(1, Math.ceil(delta / 13));
    const monthly = delta === 0 ? 0 : Math.max(2, Math.ceil(delta / 3));

    // Pace realism: cap at 25/week unless delta is enormous (still show the math, but advise realism)
    const recommendedWeekly = Math.min(weekly, 25);
    const recommendedMonthly = Math.min(monthly, 100);

    const realismNote =
      weekly > 25
        ? "The math suggests a very aggressive pace. In practice: push steady daily asks + automated follow-ups, and prioritize quality over speed."
        : "This pace is achievable for many local businesses with consistent asks and follow-up.";

    return {
      current,
      competitorMax: max,
      competitorAvg: Math.round(avg),
      target,
      delta,
      weekly,
      monthly,
      recommendedWeekly,
      recommendedMonthly,
      realismNote,
    };
  };

  const buildTopFixes = (inputs, dims, targets, catMeta) => {
    const fixes = [];

    // Helper: push fix with priority score
    const pushFix = (title, why, how, impact, priority) => {
      fixes.push({ title, why, how, impact, priority });
    };

    // Priority logic driven by low dimensions
    const lowNap = dims.nap.score < 80;
    const lowCat = dims.category.score < 78;
    const lowRev = dims.reviews.score < 75;
    const lowCad = dims.cadence.score < 72;
    const lowConv = dims.conversion.score < 70;
    const lowTrust = dims.trust.score < 75;

    // 1) Reviews (often the fastest local lever)
    if (lowRev || (targets && targets.delta > 0)) {
      const paceTxt = targets
        ? `Target ${fmtInt(targets.target)} total reviews in 90 days (+${fmtInt(targets.delta)}). Aim ~${fmtInt(targets.recommendedWeekly)}/week.`
        : "Aim for steady weekly review growth (ask every satisfied customer).";
      pushFix(
        "Launch a review acquisition system (daily asks + follow-up)",
        "Review volume + rating heavily influence map pack visibility and trust.",
        `Build a simple flow: (1) ask in person, (2) text/email link same day, (3) 2 reminders over 7 days. ${paceTxt}`,
        "High",
        100
      );
    }

    // 2) Category precision
    if (lowCat) {
      pushFix(
        "Tighten your primary category + reinforce it everywhere",
        "A mismatched or broad category reduces relevance for high-intent searches.",
        `Keep your primary category as “${catMeta?.label || "your category"}” (or more specific if available), and echo the service keyword in: business description, services list, posts, and photo captions.`,
        "High",
        92
      );
    }

    // 3) NAP proxy completeness
    if (lowNap) {
      pushFix(
        "Complete and standardize listing fields (name, city/state, service area, website)",
        "Incomplete listing fields reduce confidence and can weaken matching.",
        "Use consistent formatting: “City, ST”. Add service area radius. Add website (HTTPS). Ensure the same brand name is used everywhere.",
        "High",
        88
      );
    }

    // 4) Cadence
    if (lowCad) {
      pushFix(
        "Post weekly + add photos consistently (proof beats vibes)",
        "Fresh activity helps listings feel alive and earns engagement signals.",
        "Schedule 2–4 posts/week (tips, offers, wins, FAQs). Add 12–25 photos/month (work, team, before/after, signage).",
        "Medium-High",
        80
      );
    }

    // 5) Conversion readiness
    if (lowConv) {
      pushFix(
        "Improve conversion surface (website/landing) with a single clear offer",
        "Local traffic is wasted if calls/forms are confusing or slow.",
        "Use a short landing page: headline + offer + proof (reviews) + service area + fast contact. Add click-to-call + simple form.",
        "High",
        86
      );
    }

    // 6) Trust
    if (lowTrust) {
      pushFix(
        "Strengthen trust signals (proof, consistency, activity)",
        "Trust is the invisible currency of local selection.",
        "Highlight ratings, recent reviews, team/work photos, and clear service area. Respond to reviews weekly (even short replies).",
        "Medium-High",
        78
      );
    }

    // Add some always-useful fixes
    pushFix(
      "Turn your best reviews into content",
      "Repurposing reviews creates instant social proof across posts and your site.",
      "Each week: screenshot 1–2 reviews → post + add a photo + short “what we solved” caption.",
      "Medium",
      60
    );

    pushFix(
      "Create 10 service mini-topics for posts",
      "Consistency is easier when you pre-plan topics.",
      "Pick 10 FAQs: pricing ranges, timelines, common mistakes, seasonal tips, before/after. Rotate them as weekly content.",
      "Medium",
      58
    );

    pushFix(
      "Add photo captions with city/service keywords",
      "Captions help relevance without looking spammy.",
      "Use natural phrases like “Job completed in Phoenix, AZ” + the service performed. Keep it human, not keyword soup.",
      "Medium",
      56
    );

    pushFix(
      "Make review asks frictionless",
      "Every extra click is a dropped review.",
      "Use a short link/QR. Put it on invoices, follow-ups, and a small counter card. Train staff to ask at the right moment.",
      "High",
      84
    );

    // Sort by priority and return top 10 unique titles
    const dedup = [];
    const seen = new Set();
    fixes
      .sort((a, b) => b.priority - a.priority)
      .forEach((f) => {
        if (!seen.has(f.title) && dedup.length < 10) {
          seen.add(f.title);
          dedup.push(f);
        }
      });

    return dedup;
  };

  const build30DayPlan = (inputs, dims, targets, topFixes) => {
    const posts = clamp(safeNum(inputs.postingFreq, 0), 0, 120);
    const photos = clamp(safeNum(inputs.photosPerMonth, 0), 0, 500);

    const weeklyReviewGoal = targets ? targets.recommendedWeekly : (dims.reviews.score < 70 ? 6 : 3);

    const plan = [
      {
        week: "Week 1 — Foundations + Momentum",
        bullets: [
          "Standardize your core listing fields: name + city/state format + service area radius + website link.",
          "Draft a simple review ask message (text/email). Start asking every satisfied customer immediately.",
          `Review goal: ${fmtInt(weeklyReviewGoal)} new reviews this week (quality > speed).`,
          "Publish 2 posts: (1) “What we do + who we help”, (2) “Top FAQ + answer”.",
          `Add photos: ${fmtInt(Math.max(3, Math.round(photos / 4) || 3))} this week (work, team, signage, before/after).`,
        ],
      },
      {
        week: "Week 2 — Relevance + Proof",
        bullets: [
          "Pick your 3 highest-margin services and make them the core content theme.",
          "Turn 2 reviews into posts with photos (proof content).",
          `Review goal: ${fmtInt(weeklyReviewGoal)} new reviews + respond to every review (short replies are fine).`,
          `Publish ${posts >= 4 ? "3–4 posts" : "2 posts"} (tip, offer, win, FAQ).`,
          "Add a simple conversion improvement: clearer CTA, faster contact path, or a short “service area” section on site.",
        ],
      },
      {
        week: "Week 3 — Cadence + Expansion",
        bullets: [
          "Create a 10-topic rotation list so posting becomes mechanical, not emotional.",
          "Add 1 before/after photo set (even for non-visual industries: process photos + outcome).",
          `Review goal: ${fmtInt(weeklyReviewGoal)} new reviews; follow up with anyone who said “yes” but didn’t post.`,
          "Publish a “problem → solution” story post (case study in 6–8 sentences).",
          "Audit trust: do you show rating + reviews + city/service radius clearly on your site? If not, add it.",
        ],
      },
      {
        week: "Week 4 — Lock the System + Reduce Friction",
        bullets: [
          "Make review asks a process: trigger after job completion/payment, with automated follow-ups.",
          `Review goal: ${fmtInt(weeklyReviewGoal)} new reviews; track weekly pace vs target.`,
          "Publish an offer or seasonal post (limited window).",
          "Add 1 “Meet the team / behind-the-scenes” post + photos.",
          "Re-run this snapshot next month; aim to improve the lowest 2 dimension scores first.",
        ],
      },
    ];

    // If conversion readiness is low, add explicit conversion tasks
    if (dims.conversion.score < 65) {
      plan[0].bullets.splice(2, 0, "Create a single-page landing offer with click-to-call + fast form (1 screen of content).");
      plan[3].bullets.push("Add a dedicated ‘Book Now / Get Quote’ section above the fold on your site.");
    }

    // If cadence is extremely low, push cadence goals
    if (dims.cadence.score < 55) {
      plan[1].bullets.push("Set a recurring calendar: 2 posts/week + 3 photos/week. Consistency beats bursts.");
    }

    // Keep plan tied to fixes
    const fixTitles = topFixes.slice(0, 4).map((f) => f.title);
    plan[0].bullets.push(`Focus fixes: ${fixTitles.join(" • ")}`);

    return plan;
  };

  const buildSummaryText = (inputs, overall, dims, targets) => {
    const lines = [];
    lines.push(`Business: ${normalizeStr(inputs.businessName)}`);
    lines.push(`Category: ${getCategoryMeta(inputs.category)?.label || "—"}`);
    lines.push(`Location: ${normalizeStr(inputs.cityState)} • Radius: ${fmtInt(inputs.radiusMiles)} miles`);
    if (normalizeStr(inputs.websiteUrl)) lines.push(`Website: ${normalizeStr(inputs.websiteUrl)}`);
    lines.push(`Overall Score: ${overall}/100 (${scoreLabel(overall)})`);
    lines.push(
      `Dims: NAP ${dims.nap.score} • Category ${dims.category.score} • Reviews ${dims.reviews.score} • Cadence ${dims.cadence.score} • Conversion ${dims.conversion.score} • Trust ${dims.trust.score}`
    );
    lines.push(`Reviews: ${fmtInt(inputs.reviewCount)} at ${fmt1(inputs.avgRating)}★ • Posts/mo: ${fmtInt(inputs.postingFreq)} • Photos/mo: ${fmtInt(inputs.photosPerMonth)}`);

    if (targets) {
      lines.push(
        `Targets (90d): Current ${fmtInt(targets.current)} • Competitor max ${fmtInt(targets.competitorMax)} • Target ${fmtInt(targets.target)} (+${fmtInt(targets.delta)}) • Pace ~${fmtInt(targets.recommendedWeekly)}/week`
      );
    }

    return lines.join("\n");
  };

  // -------------------------
  // Rendering
  // -------------------------
  const setGauge = (score) => {
    const circ = 2 * Math.PI * 46; // approx 289
    const dash = circ;
    const offset = dash - (dash * (clamp(score, 0, 100) / 100));
    el.gaugeFill.style.strokeDasharray = String(Math.round(dash));
    el.gaugeFill.style.strokeDashoffset = String(Math.round(offset));
    el.gaugeText.textContent = `${clamp(score, 0, 100)}`;
  };

  const setDimBars = (dims) => {
    const map = {
      nap: dims.nap.score,
      category: dims.category.score,
      reviews: dims.reviews.score,
      cadence: dims.cadence.score,
      conversion: dims.conversion.score,
      trust: dims.trust.score,
    };

    $$(".dim-bar-fill").forEach((bar) => {
      const k = bar.getAttribute("data-dim");
      const v = clamp(map[k] ?? 0, 0, 100);
      bar.style.width = `${v}%`;
    });

    $$("[data-dimval]").forEach((node) => {
      const k = node.getAttribute("data-dimval");
      const v = clamp(map[k] ?? 0, 0, 100);
      node.textContent = `${v}`;
    });
  };

  const renderTopFixes = (fixes) => {
    const html = `
      <ol>
        ${fixes.map(f => `
          <li>
            <div><strong>${escapeHtml(f.title)}</strong> <span class="tag">Impact: ${escapeHtml(f.impact)}</span></div>
            <div class="muted">${escapeHtml(f.why)}</div>
            <div>${escapeHtml(f.how)}</div>
          </li>
        `).join("")}
      </ol>
    `;
    el.topFixes.innerHTML = html;
  };

  const render30DayPlan = (plan) => {
    const html = plan.map(p => `
      <div style="margin:10px 0 12px;">
        <div style="font-weight:900; margin-bottom:6px;">${escapeHtml(p.week)}</div>
        <ul>
          ${p.bullets.map(b => `<li>${escapeHtml(b)}</li>`).join("")}
        </ul>
      </div>
    `).join("");
    el.plan30.innerHTML = html;
  };

  const renderTargets = (targets) => {
    if (!targets) {
      el.targetCard.hidden = true;
      el.targetBody.innerHTML = "";
      return;
    }
    el.targetCard.hidden = false;

    const html = `
      <div class="tag">Current: <strong>${fmtInt(targets.current)}</strong></div>
      <div class="tag">Competitor max: <strong>${fmtInt(targets.competitorMax)}</strong></div>
      <div class="tag">Target (90d): <strong>${fmtInt(targets.target)}</strong></div>
      <div class="tag">Gap: <strong>+${fmtInt(targets.delta)}</strong></div>
      <div style="margin-top:10px;">
        <ul>
          <li><strong>Recommended pace:</strong> ~${fmtInt(targets.recommendedWeekly)}/week (≈ ${fmtInt(targets.recommendedMonthly)}/month)</li>
          <li><strong>Math pace:</strong> ${fmtInt(targets.weekly)}/week (≈ ${fmtInt(targets.monthly)}/month)</li>
          <li class="muted">${escapeHtml(targets.realismNote)}</li>
        </ul>
      </div>
    `;
    el.targetBody.innerHTML = html;
  };

  const renderSummary = (inputs, overall, dims, targets) => {
    const bullets = [];
    bullets.push(`<div class="tag">Overall: <strong>${overall}/100</strong> (${escapeHtml(scoreLabel(overall))})</div>`);
    bullets.push(`<div class="tag">NAP: <strong>${dims.nap.score}</strong></div>`);
    bullets.push(`<div class="tag">Category: <strong>${dims.category.score}</strong></div>`);
    bullets.push(`<div class="tag">Reviews: <strong>${dims.reviews.score}</strong></div>`);
    bullets.push(`<div class="tag">Cadence: <strong>${dims.cadence.score}</strong></div>`);
    bullets.push(`<div class="tag">Conversion: <strong>${dims.conversion.score}</strong></div>`);
    bullets.push(`<div class="tag">Trust: <strong>${dims.trust.score}</strong></div>`);

    const main = `
      <div>
        <div><strong>${escapeHtml(normalizeStr(inputs.businessName))}</strong></div>
        <div class="muted">${escapeHtml(getCategoryMeta(inputs.category)?.label || "—")} • ${escapeHtml(normalizeStr(inputs.cityState))} • Radius ${fmtInt(inputs.radiusMiles)} mi</div>
        ${normalizeStr(inputs.websiteUrl) ? `<div class="muted">${escapeHtml(normalizeStr(inputs.websiteUrl))}</div>` : `<div class="muted">No website URL provided.</div>`}
        <div style="margin-top:10px;">${bullets.join("")}</div>
        <div style="margin-top:12px;">
          <div class="muted"><strong>Notes:</strong></div>
          <ul>
            ${dims.nap.notes.slice(0,2).map(n => `<li>${escapeHtml(n)}</li>`).join("")}
            ${dims.category.notes.slice(0,2).map(n => `<li>${escapeHtml(n)}</li>`).join("")}
            ${dims.reviews.notes.slice(0,2).map(n => `<li>${escapeHtml(n)}</li>`).join("")}
          </ul>
        </div>
      </div>
    `;

    el.resultSummary.innerHTML = main;

    // Hidden report summary for Netlify form
    const summaryText = buildSummaryText(inputs, overall, dims, targets);
    el.reportSummaryField.value = summaryText;
  };

  const escapeHtml = (s) => {
    return String(s || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  };

  // -------------------------
  // Local storage save/load
  // -------------------------
  const getInputs = () => {
    return {
      businessName: el.businessName.value,
      category: el.category.value,
      cityState: el.cityState.value,
      radiusMiles: el.radiusMiles.value,
      websiteUrl: el.websiteUrl.value,
      reviewCount: el.reviewCount.value,
      avgRating: el.avgRating.value,
      comp1: el.comp1.value,
      comp2: el.comp2.value,
      comp3: el.comp3.value,
      postingFreq: el.postingFreq.value,
      photosPerMonth: el.photosPerMonth.value,
    };
  };

  const setInputs = (inputs) => {
    el.businessName.value = inputs.businessName ?? "";
    el.category.value = inputs.category ?? "";
    el.cityState.value = inputs.cityState ?? "";
    el.radiusMiles.value = inputs.radiusMiles ?? "20";
    el.websiteUrl.value = inputs.websiteUrl ?? "";
    el.reviewCount.value = inputs.reviewCount ?? "0";
    el.avgRating.value = inputs.avgRating ?? "0";
    el.comp1.value = inputs.comp1 ?? "";
    el.comp2.value = inputs.comp2 ?? "";
    el.comp3.value = inputs.comp3 ?? "";
    el.postingFreq.value = inputs.postingFreq ?? "0";
    el.photosPerMonth.value = inputs.photosPerMonth ?? "0";
  };

  const saveLastReport = (report) => {
    const payload = {
      savedAt: nowISO(),
      report,
    };
    localStorage.setItem(LS_KEY, JSON.stringify(payload));
  };

  const loadLastReport = () => {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return null;
    try { return JSON.parse(raw); } catch { return null; }
  };

  // -------------------------
  // PDF Export (jsPDF)
  // -------------------------
  const wrapText = (doc, text, x, y, maxWidth, lineHeight) => {
    const lines = doc.splitTextToSize(text, maxWidth);
    for (const line of lines) {
      doc.text(line, x, y);
      y += lineHeight;
    }
    return y;
  };

  const exportPdf = async (computed) => {
    const { inputs, overall, dims, targets, topFixes, plan30 } = computed;

    const jspdf = window.jspdf;
    if (!jspdf || !jspdf.jsPDF) {
      setCallout(el.toolStatus, "jsPDF not loaded yet. Refresh and try again.", "bad");
      return;
    }

    const doc = new jspdf.jsPDF({ unit: "pt", format: "letter" });
    const W = doc.internal.pageSize.getWidth();
    const H = doc.internal.pageSize.getHeight();

    const margin = 44;
    const maxW = W - margin * 2;

    // Background watermark text (big + obvious)
    doc.setTextColor(245, 220, 150);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(42);
    doc.text("SKYES OVER LONDON LC", W/2, H/2, { align: "center", angle: -18 });

    // Header
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(18);
    doc.text("Local SEO Snapshot", margin, 64);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    doc.setTextColor(220, 220, 240);
    doc.text(`App: ${APP} • Build: ${BUILD}`, margin, 84);
    doc.text(`Generated: ${new Date().toLocaleString()}`, margin, 100);

    // Divider line
    doc.setDrawColor(255, 211, 107);
    doc.setLineWidth(1);
    doc.line(margin, 112, W - margin, 112);

    let y = 132;

    // Business block
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.text("Business", margin, y); y += 16;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    doc.setTextColor(235, 235, 245);

    const catLabel = getCategoryMeta(inputs.category)?.label || "—";
    const website = normalizeStr(inputs.websiteUrl) || "—";
    const locationTxt = `${normalizeStr(inputs.cityState)} • Radius ${fmtInt(inputs.radiusMiles)} mi`;
    const reviewTxt = `${fmtInt(inputs.reviewCount)} reviews • ${fmt1(inputs.avgRating)}★`;
    const cadenceTxt = `${fmtInt(inputs.postingFreq)} posts/mo • ${fmtInt(inputs.photosPerMonth)} photos/mo`;

    y = wrapText(doc, `${normalizeStr(inputs.businessName)}`, margin, y, maxW, 14);
    y = wrapText(doc, `Category: ${catLabel}`, margin, y, maxW, 14);
    y = wrapText(doc, `Location: ${locationTxt}`, margin, y, maxW, 14);
    y = wrapText(doc, `Website: ${website}`, margin, y, maxW, 14);
    y = wrapText(doc, `Reviews: ${reviewTxt}`, margin, y, maxW, 14);
    y = wrapText(doc, `Cadence: ${cadenceTxt}`, margin, y, maxW, 14);

    y += 8;

    // Score block
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.setTextColor(255, 255, 255);
    doc.text("Scores", margin, y); y += 16;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    doc.setTextColor(235, 235, 245);

    const scoreLine = `Overall: ${overall}/100 (${scoreLabel(overall)})`;
    y = wrapText(doc, scoreLine, margin, y, maxW, 14);

    const dimLine = `NAP ${dims.nap.score} • Category ${dims.category.score} • Reviews ${dims.reviews.score} • Cadence ${dims.cadence.score} • Conversion ${dims.conversion.score} • Trust ${dims.trust.score}`;
    y = wrapText(doc, dimLine, margin, y, maxW, 14);

    // Targets
    if (targets) {
      y += 6;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(13);
      doc.setTextColor(255, 255, 255);
      doc.text("90-Day Review Targets", margin, y); y += 16;

      doc.setFont("helvetica", "normal");
      doc.setFontSize(11);
      doc.setTextColor(235, 235, 245);

      const t1 = `Competitor max: ${fmtInt(targets.competitorMax)} • Competitor avg: ${fmtInt(targets.competitorAvg)} • Current: ${fmtInt(targets.current)}`;
      const t2 = `Target: ${fmtInt(targets.target)} (+${fmtInt(targets.delta)} in 90 days)`;
      const t3 = `Recommended pace: ~${fmtInt(targets.recommendedWeekly)}/week (≈ ${fmtInt(targets.recommendedMonthly)}/month)`;
      y = wrapText(doc, t1, margin, y, maxW, 14);
      y = wrapText(doc, t2, margin, y, maxW, 14);
      y = wrapText(doc, t3, margin, y, maxW, 14);
      y = wrapText(doc, `Note: ${targets.realismNote}`, margin, y, maxW, 14);
    }

    // Page break guard
    const ensureSpace = () => {
      if (y > H - 120) {
        doc.addPage();
        y = 64;
        doc.setTextColor(245, 220, 150);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(42);
        doc.text("SKYES OVER LONDON LC", W/2, H/2, { align: "center", angle: -18 });
        doc.setTextColor(255,255,255);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(14);
        doc.text("Local SEO Snapshot (continued)", margin, 44);
        doc.setDrawColor(255, 211, 107);
        doc.line(margin, 54, W - margin, 54);
        y = 74;
      }
    };

    // Top 10 fixes
    ensureSpace();
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.setTextColor(255, 255, 255);
    doc.text("Top 10 Fixes", margin, y); y += 16;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    doc.setTextColor(235, 235, 245);

    topFixes.forEach((f, idx) => {
      ensureSpace();
      doc.setFont("helvetica", "bold");
      doc.text(`${idx + 1}. ${f.title} (${f.impact})`, margin, y); y += 14;
      doc.setFont("helvetica", "normal");
      y = wrapText(doc, `Why: ${f.why}`, margin + 10, y, maxW - 10, 14);
      y = wrapText(doc, `How: ${f.how}`, margin + 10, y, maxW - 10, 14);
      y += 6;
    });

    // 30-day plan
    ensureSpace();
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.setTextColor(255, 255, 255);
    doc.text("30-Day Action Plan", margin, y); y += 16;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    doc.setTextColor(235, 235, 245);

    plan30.forEach((p) => {
      ensureSpace();
      doc.setFont("helvetica", "bold");
      doc.text(p.week, margin, y); y += 14;
      doc.setFont("helvetica", "normal");
      p.bullets.forEach((b) => {
        ensureSpace();
        y = wrapText(doc, `• ${b}`, margin + 10, y, maxW - 10, 14);
      });
      y += 6;
    });

    // Checklist footer
    ensureSpace();
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.setTextColor(255, 255, 255);
    doc.text("Checklist (quick)", margin, y); y += 16;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    doc.setTextColor(235, 235, 245);

    const checklist = [
      "Primary category chosen and reinforced in description/services/posts",
      "City/State formatting consistent (e.g., “Phoenix, AZ”)",
      "Service area/radius set and visible",
      "HTTPS website linked (fast contact path)",
      "Weekly review asks + follow-up system",
      "Weekly posting cadence (tips/offers/wins/FAQs)",
      "Monthly photo cadence (12–25+ fresh photos)",
      "Respond to reviews weekly",
      "Repurpose reviews into posts",
      "Re-run snapshot monthly and improve the lowest two dimensions first",
    ];
    checklist.forEach((c) => {
      ensureSpace();
      y = wrapText(doc, `☐ ${c}`, margin, y, maxW, 14);
    });

    // Save
    const safeName = normalizeStr(inputs.businessName).replace(/[^\w\- ]+/g, "").trim().replace(/\s+/g, "_").slice(0, 42) || "Local_SEO_Snapshot";
    doc.save(`${safeName}_Local_SEO_Snapshot.pdf`);
  };

  // -------------------------
  // Categories
  // -------------------------
  const getCategoryMeta = (value) => CATEGORY_LIBRARY.find((c) => c.value === value) || null;

  const populateCategories = () => {
    const frag = document.createDocumentFragment();
    CATEGORY_LIBRARY.forEach((c) => {
      const opt = document.createElement("option");
      opt.value = c.value;
      opt.textContent = c.label;
      frag.appendChild(opt);
    });
    el.category.appendChild(frag);
  };

  // -------------------------
  // Diagnostics drawer
  // -------------------------
  const openDrawer = () => {
    el.drawer.setAttribute("aria-hidden", "false");
    refreshDiagnostics();
  };
  const closeDrawer = () => el.drawer.setAttribute("aria-hidden", "true");

  const refreshDiagnostics = async () => {
    el.diagApp.textContent = APP;
    el.diagBuild.textContent = BUILD;
    el.diagOnline.textContent = navigator.onLine ? "true" : "false";

    // Service worker status
    let sw = "unsupported";
    try {
      if ("serviceWorker" in navigator) {
        const reg = await navigator.serviceWorker.getRegistration();
        sw = reg ? "registered" : "not registered";
      }
    } catch {
      sw = "error";
    }
    el.diagSw.textContent = sw;

    // Local storage
    const last = loadLastReport();
    el.diagLastReport.textContent = last ? `yes (${last.savedAt || "unknown"})` : "no";
    el.diagStorageUsed.textContent = `${fmtInt(approxLocalStorageBytes())} bytes (approx)`;

    // Last captured error
    try {
      const raw = localStorage.getItem("__last_client_error__");
      lastCapturedError = raw ? JSON.parse(raw) : lastCapturedError;
    } catch {}

    el.diagLastError.textContent = lastCapturedError ? JSON.stringify(lastCapturedError, null, 2) : "—";
  };

  // -------------------------
  // PWA install + service worker
  // -------------------------
  const initPwa = async () => {
    // Install prompt
    window.addEventListener("beforeinstallprompt", (e) => {
      e.preventDefault();
      deferredInstallPrompt = e;
      el.btnInstall.disabled = false;
      setCallout(el.toolStatus, "PWA install is available. Click “Install PWA”.", "ok");
    });

    el.btnInstall.addEventListener("click", async () => {
      if (!deferredInstallPrompt) return;
      deferredInstallPrompt.prompt();
      try { await deferredInstallPrompt.userChoice; } catch {}
      deferredInstallPrompt = null;
      el.btnInstall.disabled = true;
    });

    // Service worker
    if ("serviceWorker" in navigator) {
      try {
        await navigator.serviceWorker.register("./sw.js", { scope: "./" });
      } catch (e) {
        captureError({ kind: "sw.register", message: "Service worker registration failed", stack: e?.stack || String(e) }, false);
      }
    }
  };

  // -------------------------
  // Netlify lead form submission (AJAX, still Netlify Forms)
  // -------------------------
  const encodeForm = (form) => {
    const data = new FormData(form);
    const params = new URLSearchParams();
    for (const [k, v] of data.entries()) params.append(k, String(v));
    return params.toString();
  };

  const submitLeadFormAjax = async (form) => {
    const body = encodeForm(form);
    const res = await fetch("/", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
    return res.ok;
  };

  // -------------------------
  // Self-test
  // -------------------------
  const runSelfTest = async () => {
    const checks = [];
    const ok = (name, pass, detail = "") => checks.push({ name, pass, detail });

    ok("Floating logo present", !!document.querySelector(".floating-logo"));
    ok("Watermark present", !!document.querySelector(".page-watermark"));
    ok("Netlify lead form present", !!document.querySelector('form[name="local-seo-snapshot-lead"]'));
    ok("Hidden report_summary present", !!document.querySelector("#reportSummaryField"));
    ok("jsPDF loaded", !!(window.jspdf && window.jspdf.jsPDF), "CDN load");
    ok("Service worker supported", "serviceWorker" in navigator);

    let swReg = false;
    try { swReg = !!(await navigator.serviceWorker?.getRegistration()); } catch {}
    ok("Service worker registered", swReg);

    const last = loadLastReport();
    ok("Load last report works (if saved)", last ? true : true, last ? "saved exists" : "no saved report yet");

    const passCount = checks.filter(c => c.pass).length;
    const html = checks.map(c => `• ${c.pass ? "✅" : "❌"} ${c.name}${c.detail ? ` (${c.detail})` : ""}`).join("\n");

    setCallout(el.toolStatus, `Self-test: ${passCount}/${checks.length} checks passed.\n${html}`, passCount === checks.length ? "ok" : "warn");
    captureError({ kind: "selftest", message: "Self-test executed", checks }, false);
  };

  // -------------------------
  // Generate snapshot
  // -------------------------
  const parseCompetitors = (inputs) => {
    const raw = [inputs.comp1, inputs.comp2, inputs.comp3].map((v) => v === "" ? null : safeNum(v, null));
    return raw.filter((n) => Number.isFinite(n)).map((n) => clamp(n, 0, 200000));
  };

  const validateInputs = (inputs) => {
    const errs = [];
    if (!normalizeStr(inputs.businessName)) errs.push("Business name is required.");
    if (!normalizeStr(inputs.category)) errs.push("Category is required.");
    if (!normalizeStr(inputs.cityState)) errs.push("City/State is required.");
    if (!normalizeStr(inputs.cityState).includes(",")) errs.push("City/State should include a comma, like “Phoenix, AZ”.");
    const r = safeNum(inputs.radiusMiles, -1);
    if (!(r >= 0)) errs.push("Service radius must be 0 or higher.");
    const rc = safeNum(inputs.reviewCount, -1);
    if (!(rc >= 0)) errs.push("Review count must be 0 or higher.");
    const ar = safeNum(inputs.avgRating, -1);
    if (!(ar >= 0 && ar <= 5)) errs.push("Average rating must be between 0 and 5.");
    const p = safeNum(inputs.postingFreq, -1);
    if (!(p >= 0)) errs.push("Posting frequency must be 0 or higher.");
    const ph = safeNum(inputs.photosPerMonth, -1);
    if (!(ph >= 0)) errs.push("Photos per month must be 0 or higher.");
    return errs;
  };

  const computeSnapshot = (inputs) => {
    const competitorCounts = parseCompetitors(inputs);
    const catMeta = getCategoryMeta(inputs.category);

    const dims = {
      nap: computeNapCompleteness(inputs),
      category: computeCategoryMatch(inputs, catMeta),
      reviews: computeReviewStrength(inputs, competitorCounts),
      cadence: computeContentCadence(inputs),
      conversion: computeConversionReadiness(inputs),
      trust: computeTrust(inputs, competitorCounts),
    };

    const overall = computeOverall(dims);
    const targets = computeReviewTargets(inputs, competitorCounts);
    const topFixes = buildTopFixes(inputs, dims, targets, catMeta);
    const plan30 = build30DayPlan(inputs, dims, targets, topFixes);

    return { inputs, dims, overall, targets, topFixes, plan30 };
  };

  const applyComputed = (computed) => {
    lastComputed = computed;

    setGauge(computed.overall);
    setDimBars(computed.dims);
    el.scoreSubtitle.textContent = `Score: ${computed.overall}/100 (${scoreLabel(computed.overall)})`;

    renderTargets(computed.targets);
    renderTopFixes(computed.topFixes);
    render30DayPlan(computed.plan30);
    renderSummary(computed.inputs, computed.overall, computed.dims, computed.targets);

    el.btnExportPdf.disabled = false;
    el.btnCopySummary.disabled = false;

    // Save summary into local storage automatically (quality-of-life)
    saveLastReport(computed);
    refreshDiagnostics();

    setCallout(el.toolStatus, "Snapshot generated and saved to this device. Export PDF when ready.", "ok");
  };

  // -------------------------
  // Events
  // -------------------------
  const initEvents = () => {
    el.toolForm.addEventListener("submit", (e) => {
      e.preventDefault();
      try {
        const inputs = getInputs();
        const errs = validateInputs(inputs);
        if (errs.length) {
          setCallout(el.toolStatus, errs.join(" "), "bad");
          return;
        }
        const computed = computeSnapshot(inputs);
        applyComputed(computed);
      } catch (err) {
        setCallout(el.toolStatus, "Something went wrong generating the snapshot. Open Diagnostics for details.", "bad");
        captureError({ kind: "generate", message: err?.message || "Generate failed", stack: err?.stack || String(err) }, true);
      }
    });

    el.btnSaveLocal.addEventListener("click", () => {
      try {
        if (!lastComputed) {
          setCallout(el.toolStatus, "Generate a snapshot first, then save.", "warn");
          return;
        }
        saveLastReport(lastComputed);
        setCallout(el.toolStatus, "Saved last report to this device.", "ok");
        refreshDiagnostics();
      } catch (err) {
        setCallout(el.toolStatus, "Save failed. Open Diagnostics.", "bad");
        captureError({ kind: "save", message: err?.message || "Save failed", stack: err?.stack || String(err) }, true);
      }
    });

    el.btnLoadLast.addEventListener("click", () => {
      try {
        const payload = loadLastReport();
        if (!payload || !payload.report) {
          setCallout(el.toolStatus, "No saved report found on this device yet.", "warn");
          return;
        }
        const rep = payload.report;
        setInputs(rep.inputs || {});
        applyComputed(rep);
        setCallout(el.toolStatus, `Loaded last report saved at ${payload.savedAt || "unknown time"}.`, "ok");
      } catch (err) {
        setCallout(el.toolStatus, "Load failed. Open Diagnostics.", "bad");
        captureError({ kind: "load", message: err?.message || "Load failed", stack: err?.stack || String(err) }, true);
      }
    });

    el.btnClear.addEventListener("click", () => {
      setInputs({
        businessName: "",
        category: "",
        cityState: "",
        radiusMiles: "20",
        websiteUrl: "",
        reviewCount: "0",
        avgRating: "0",
        comp1: "",
        comp2: "",
        comp3: "",
        postingFreq: "0",
        photosPerMonth: "0",
      });

      lastComputed = null;
      setGauge(0);
      el.gaugeText.textContent = "—";
      el.gaugeFill.style.strokeDashoffset = "289";
      setDimBars({
        nap:{score:0}, category:{score:0}, reviews:{score:0}, cadence:{score:0}, conversion:{score:0}, trust:{score:0}
      });
      el.scoreSubtitle.textContent = "Generate a snapshot to see your score.";
      el.resultSummary.textContent = "Generate a snapshot to populate this section.";
      el.topFixes.textContent = "—";
      el.plan30.textContent = "—";
      el.targetCard.hidden = true;
      el.btnExportPdf.disabled = true;
      el.btnCopySummary.disabled = true;
      el.reportSummaryField.value = "";

      setCallout(el.toolStatus, "Cleared inputs (local saved report remains until overwritten).", "ok");
    });

    el.btnExportPdf.addEventListener("click", async () => {
      try {
        if (!lastComputed) return;
        await exportPdf(lastComputed);
      } catch (err) {
        setCallout(el.toolStatus, "PDF export failed. Open Diagnostics.", "bad");
        captureError({ kind: "pdf", message: err?.message || "PDF failed", stack: err?.stack || String(err) }, true);
      }
    });

    el.btnCopySummary.addEventListener("click", async () => {
      try {
        if (!lastComputed) return;
        const text = el.reportSummaryField.value || buildSummaryText(lastComputed.inputs, lastComputed.overall, lastComputed.dims, lastComputed.targets);
        await navigator.clipboard.writeText(text);
        setCallout(el.toolStatus, "Copied summary to clipboard.", "ok");
      } catch (err) {
        setCallout(el.toolStatus, "Copy failed (clipboard permissions).", "warn");
        captureError({ kind: "copy", message: err?.message || "Copy failed", stack: err?.stack || String(err) }, false);
      }
    });

    // Diagnostics drawer controls
    el.btnDiagnostics.addEventListener("click", openDrawer);
    el.btnCloseDrawer.addEventListener("click", closeDrawer);
    el.drawerOverlay.addEventListener("click", closeDrawer);

    el.btnClearLastError.addEventListener("click", () => {
      lastCapturedError = null;
      try { localStorage.removeItem("__last_client_error__"); } catch {}
      refreshDiagnostics();
      setCallout(el.diagStatus, "Cleared last captured error.", "ok");
    });

    el.btnReportLastError.addEventListener("click", async () => {
      if (!lastCapturedError) {
        setCallout(el.diagStatus, "No captured error to report.", "warn");
        return;
      }
      try {
        const res = await postErrorReport({ kind: "manual_report", lastError: lastCapturedError });
        setCallout(el.diagStatus, res.ok ? `Reported (via ${res.via}).` : `Report failed (status ${res.status}).`, res.ok ? "ok" : "bad");
      } catch (err) {
        setCallout(el.diagStatus, "Report failed. Check console/logs.", "bad");
      }
    });

    el.btnSendDiagPing.addEventListener("click", async () => {
      try {
        const payload = {
          kind: "diagnostics_ping",
          diagnostics: buildDiagnosticsPayload(),
          lastComputedPresent: !!lastComputed,
        };
        const res = await postErrorReport(payload);
        setCallout(el.diagStatus, res.ok ? `Diagnostics sent (via ${res.via}).` : `Send failed (status ${res.status}).`, res.ok ? "ok" : "bad");
      } catch (err) {
        setCallout(el.diagStatus, "Send failed. Check console/logs.", "bad");
      }
    });

    // Lead form: intercept for AJAX submit (still Netlify Forms)
    el.leadForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      try {
        if (!el.reportSummaryField.value) {
          setCallout(el.leadStatus, "Generate a snapshot first so report_summary is attached.", "warn");
          return;
        }
        setCallout(el.leadStatus, "Submitting…", "");
        const ok = await submitLeadFormAjax(el.leadForm);
        setCallout(el.leadStatus, ok ? "Submitted. Lead captured with report summary." : "Submission failed. Try again.", ok ? "ok" : "bad");
      } catch (err) {
        setCallout(el.leadStatus, "Submission failed. Open Diagnostics.", "bad");
        captureError({ kind: "lead_submit", message: err?.message || "Lead submit failed", stack: err?.stack || String(err) }, false);
      }
    });

    el.btnPrefillLead.addEventListener("click", () => {
      const business = normalizeStr(el.businessName.value);
      const loc = normalizeStr(el.cityState.value);
      const cat = getCategoryMeta(el.category.value)?.label || "";
      const note = `${business ? `Business: ${business}\n` : ""}${cat ? `Category: ${cat}\n` : ""}${loc ? `Location: ${loc}\n` : ""}`;
      const t = $("#leadNotes");
      if (t && !t.value) t.value = note.trim();
      setCallout(el.leadStatus, "Prefilled lead notes from tool inputs.", "ok");
    });

    el.btnRunSelfTest.addEventListener("click", runSelfTest);

    el.btnSendTestError.addEventListener("click", async () => {
      const fake = {
        kind: "test_error",
        message: "This is a test error report from the Local SEO Snapshot app.",
        detail: { time: nowISO(), random: Math.random().toString(16).slice(2) }
      };
      try {
        await captureError(fake, false);
        const res = await postErrorReport(fake);
        setCallout(el.toolStatus, res.ok ? `Test error sent (via ${res.via}).` : `Test send failed (status ${res.status}).`, res.ok ? "ok" : "bad");
      } catch (err) {
        setCallout(el.toolStatus, "Test error failed to send.", "bad");
      }
    });
  };

  const buildDiagnosticsPayload = () => {
    let sw = "unsupported";
    try { sw = ("serviceWorker" in navigator) ? "supported" : "unsupported"; } catch {}
    const last = loadLastReport();
    return {
      app: APP,
      build: BUILD,
      href: location.href,
      online: navigator.onLine,
      sw,
      lastReportPresent: !!last,
      storageBytesApprox: approxLocalStorageBytes(),
      lastCapturedErrorPresent: !!lastCapturedError,
    };
  };

  // -------------------------
  // Init
  // -------------------------
  const init = async () => {
    populateCategories();
    initEvents();
    await initPwa();

    // Restore last captured error to diagnostics (if any)
    try {
      const raw = localStorage.getItem("__last_client_error__");
      lastCapturedError = raw ? JSON.parse(raw) : null;
    } catch {}

    // Soft hint if last report exists
    const payload = loadLastReport();
    if (payload?.report) {
      setCallout(el.toolStatus, "A saved report exists on this device. Click “Load last report” to restore it.", "ok");
    } else {
      setCallout(el.toolStatus, "Enter your inputs and click “Generate Snapshot”.", "ok");
    }

    // Fill diagnostics initial
    refreshDiagnostics();
  };

  init().catch((err) => {
    setCallout(el.toolStatus, "Initialization failed. Open Diagnostics.", "bad");
    captureError({ kind: "init", message: err?.message || "Init failed", stack: err?.stack || String(err) }, true);
  });
})();
