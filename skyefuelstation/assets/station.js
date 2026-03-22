const $ = (selector) => document.querySelector(selector);

let stationConfig = null;

function monthKeyUTC() {
  return new Date().toISOString().slice(0, 7);
}

function moneyFromCents(cents) {
  const value = Number(cents || 0);
  return `$${(value / 100).toFixed(2)}`;
}

function moneyFromUsd(usd) {
  const value = Number(usd || 0);
  return `$${value.toFixed(2)}`;
}

function number(value) {
  return new Intl.NumberFormat("en-US").format(Number(value || 0));
}

function escapeHtml(value) {
  return String(value || "").replace(/[&<>"]/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;"
  }[char]));
}

function setStatus(message, bad = false) {
  const el = $("#stationStatus");
  if (!el) return;
  el.textContent = message;
  el.style.color = bad ? "#ff8b7f" : "";
}

function renderAssets(assets) {
  const strip = $("#assetStrip");
  if (!strip) return;
  strip.innerHTML = (assets || []).map((asset) => `
    <article class="asset-card">
      <span class="role">${asset.role}</span>
      <h3>${asset.name}</h3>
      <p>${asset.description}</p>
      <strong>$${Number(asset.unit_usd || 0).toFixed(2)} per unit anchor</strong>
    </article>
  `).join("");
}

function renderConfig(data) {
  const station = data?.station || {};
  stationConfig = station;
  const pricing = station.pricing || {};
  const preview = data?.preview || {};
  $("#bonusReturnPct").textContent = `${Number(pricing.bonus_return_pct || 0)}%`;
  $("#discountPct").textContent = `${Number(pricing.discount_pct || 0)}%`;
  $("#serviceAssetName").textContent = pricing.service_asset_name || "SkyeTokens";
  renderPreviewForSpend(Number($("#previewSpendInput")?.value || preview.spend_usd || 100));

  const brainGate = station.brain_gate || {};
  const brainHeading = $("#brainGateHeading");
  const brainText = $("#brainGateText");
  const brainLink = $("#brainGateLink");
  const brainStatusPill = $("#brainGateStatusPill");
  const brainRemotePill = $("#brainGateRemotePill");
  if (brainGate.public_url) {
    brainHeading.textContent = "Dedicated brain gate configured";
    brainText.textContent = brainGate.public_url;
    brainLink.href = brainGate.public_url;
    if (brainStatusPill) brainStatusPill.textContent = "Brain URL ready";
    if (brainRemotePill) brainRemotePill.textContent = brainGate.configured ? "Remote brain declared" : "Public route only";
  } else {
    brainHeading.textContent = "Awaiting dedicated Cloudflare brain";
    brainText.textContent = "Set SKYEFUEL_STATION_BRAIN_PUBLIC_URL to surface the separate station brain gate here.";
    brainLink.href = "#brain-gate";
    if (brainStatusPill) brainStatusPill.textContent = "Config only";
    if (brainRemotePill) brainRemotePill.textContent = "Local station bridge";
  }

  renderAssets(station.assets || []);
}

function renderPreviewForSpend(spendValue) {
  const pricing = stationConfig?.pricing || {};
  const spend = Math.max(25, Number(spendValue || 100));
  const rate = Number(pricing?.rates?.token_unit_usd || 1) || 1;
  const baseUnits = spend / rate;
  const bonusUnits = baseUnits * (Number(pricing.bonus_return_pct || 0) / 100);
  const discountUsd = spend * (Number(pricing.discount_pct || 0) / 100);
  $("#previewSpendLabel").textContent = moneyFromUsd(spend);
  $("#previewBaseUnits").textContent = number(baseUnits.toFixed(2));
  $("#previewBonusUnits").textContent = number(bonusUnits.toFixed(2));
  $("#previewDiscountUsd").textContent = moneyFromUsd(discountUsd);
}

function renderStackList(selector, items, renderItem, emptyText) {
  const root = $(selector);
  if (!root) return;
  if (!items.length) {
    root.className = "stack-list empty-state";
    root.innerHTML = escapeHtml(emptyText);
    return;
  }

  root.className = "stack-list";
  root.innerHTML = items.map(renderItem).join("");
}

function renderStationOverview(data) {
  const digest = data?.digest || {};
  const storageReady = !!data?.storage_ready;
  const stationState = $("#stationStorageState");
  const liveSignal = $("#stationLiveSignal");
  const brain = data?.brain_gate || {};

  $("#digestCustomers").textContent = number(digest.active_customers || 0);
  $("#digestKeys").textContent = number(digest.active_keys || 0);
  $("#digestTopups").textContent = moneyFromCents(digest.monthly_topup_cents || 0);
  $("#digestTokens").textContent = number(digest.monthly_token_volume || 0);

  if (liveSignal) {
    liveSignal.textContent = storageReady ? "Live connected" : "Config only";
  }

  if (stationState) {
    stationState.textContent = storageReady
      ? `Public station is reading live aggregate telemetry for ${digest.month || monthKeyUTC()}.`
      : "Database telemetry is not configured, so this public page is currently running in config-only mode.";
  }

  const brainHeading = $("#brainGateHeading");
  const brainText = $("#brainGateText");
  const brainStatusPill = $("#brainGateStatusPill");
  const brainRemotePill = $("#brainGateRemotePill");
  if (brain.connected) {
    if (brainHeading) brainHeading.textContent = "Dedicated brain gate connected";
    if (brainText) brainText.textContent = `${brain.url || ""}${brain.endpoint || ""}`;
    if (brainStatusPill) brainStatusPill.textContent = "Remote connected";
    if (brainRemotePill) brainRemotePill.textContent = "Cross-brain telemetry live";
  } else if (brain.configured) {
    if (brainHeading) brainHeading.textContent = "Dedicated brain declared but not responding";
    if (brainText) brainText.textContent = brain.error || "Configured brain gate did not answer yet. Local station telemetry is still available.";
    if (brainStatusPill) brainStatusPill.textContent = "Remote unavailable";
    if (brainRemotePill) brainRemotePill.textContent = "Fallback to local metrics";
  }

  renderStackList("#planMixList", data?.plan_mix || [], (item) => `
    <article class="stack-row">
      <div>
        <strong>${escapeHtml(item.plan_name || "Custom")}</strong>
        <span>${number(item.active_customer_count || 0)} active of ${number(item.customer_count || 0)} customers</span>
      </div>
      <div class="stack-metrics">
        <span>${moneyFromCents(item.spent_cents || 0)} spent</span>
        <span>${number(item.token_volume || 0)} tokens</span>
      </div>
    </article>
  `, "No plan telemetry loaded yet.");

  renderStackList("#providerMixList", data?.provider_mix || [], (item) => `
    <article class="stack-row">
      <div>
        <strong>${escapeHtml(item.provider || "unknown")}</strong>
        <span>${number(item.event_count || 0)} routed events</span>
      </div>
      <div class="stack-metrics">
        <span>${moneyFromCents(item.spent_cents || 0)} spend</span>
        <span>${number(item.token_volume || 0)} tokens</span>
      </div>
    </article>
  `, "No provider telemetry loaded yet.");

  renderStackList("#topupSourcesList", data?.topup_sources || [], (item) => `
    <article class="stack-row">
      <div>
        <strong>${escapeHtml(item.source || "manual")}</strong>
        <span>${number(item.event_count || 0)} applied credits</span>
      </div>
      <div class="stack-metrics">
        <span>${moneyFromCents(item.amount_cents || 0)}</span>
      </div>
    </article>
  `, "No top-up telemetry loaded yet.");

  renderStackList("#stationLeaders", data?.leaders || [], (item) => `
    <article class="stack-row rank-row">
      <div>
        <strong>${escapeHtml(item.email || "hidden")}</strong>
        <span>${escapeHtml(item.plan_name || "Custom")}</span>
      </div>
      <div class="stack-metrics">
        <span>${moneyFromCents(item.spent_cents || 0)} spend</span>
        <span>${number(item.token_volume || 0)} tokens</span>
      </div>
    </article>
  `, "No leader data loaded yet.");

  const topupsBody = $("#stationTopupsBody");
  if (topupsBody) {
    const rows = data?.recent_topups || [];
    topupsBody.innerHTML = rows.length
      ? rows.map((item) => `
          <tr>
            <td>${item.created_at ? new Date(item.created_at).toLocaleString() : escapeHtml(item.month || "")}</td>
            <td>${escapeHtml(item.source || "manual")}</td>
            <td>${escapeHtml(item.status || "unknown")}</td>
            <td>${moneyFromCents(item.amount_cents || 0)}</td>
          </tr>
        `).join("")
      : '<tr><td colspan="4" class="muted">No top-up events loaded yet.</td></tr>';
  }

  const eventsBody = $("#stationEventsBody");
  if (eventsBody) {
    const rows = data?.recent_events || [];
    eventsBody.innerHTML = rows.length
      ? rows.map((item) => `
          <tr>
            <td>${item.created_at ? new Date(item.created_at).toLocaleString() : ""}</td>
            <td>${escapeHtml(item.email || "hidden")}</td>
            <td>${escapeHtml(item.provider || "")}</td>
            <td>${escapeHtml(item.model || "")}</td>
            <td>${moneyFromCents(item.cost_cents || 0)}</td>
          </tr>
        `).join("")
      : '<tr><td colspan="5" class="muted">No live events loaded yet.</td></tr>';
  }
}

async function loadConfig() {
  const res = await fetch("/.netlify/functions/skye-fuel-station-config");
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
  renderConfig(data);
}

async function loadOverview() {
  const month = ($("#stationOverviewMonth")?.value || "").trim() || monthKeyUTC();
  const res = await fetch(`/.netlify/functions/skye-fuel-station-overview?month=${encodeURIComponent(month)}`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
  if ($("#stationOverviewMonth")) $("#stationOverviewMonth").value = month;
  renderConfig(data);
  renderStationOverview(data);
}

async function loadSummary() {
  const key = ($("#stationKey")?.value || "").trim();
  const month = ($("#stationMonth")?.value || "").trim() || monthKeyUTC();
  if (!key) {
    setStatus("Enter a Kaixu key first.", true);
    return;
  }

  localStorage.setItem("SKYEFUEL_STATION_KEY", key);
  localStorage.setItem("SKYEFUEL_STATION_MONTH", month);
  setStatus("Loading live balance...");

  const res = await fetch(`/.netlify/functions/user-summary?month=${encodeURIComponent(month)}`, {
    headers: { authorization: `Bearer ${key}` }
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    setStatus(data?.error || `HTTP ${res.status}`, true);
    return;
  }

  const summary = data.month || {};
  const customer = data.customer || {};
  $("#sumPlan").textContent = customer.plan_name || "Custom";
  $("#sumCustomerRemaining").textContent = moneyFromCents(summary.customer_remaining_cents || 0);
  $("#sumKeyRemaining").textContent = moneyFromCents(summary.key_remaining_cents || 0);
  $("#sumTokens").textContent = number(summary.customer_tokens || 0);
  $("#stationSummary").classList.remove("hidden");
  setStatus(`Loaded ${month} balance for ${customer.plan_name || "client plan"}.`);
}

function clearKey() {
  localStorage.removeItem("SKYEFUEL_STATION_KEY");
  $("#stationKey").value = "";
  setStatus("Stored key cleared.");
}

function boot() {
  const month = $("#stationMonth");
  if (month && !month.value) month.value = localStorage.getItem("SKYEFUEL_STATION_MONTH") || monthKeyUTC();
  const overviewMonth = $("#stationOverviewMonth");
  if (overviewMonth && !overviewMonth.value) overviewMonth.value = month?.value || monthKeyUTC();
  const storedKey = localStorage.getItem("SKYEFUEL_STATION_KEY") || "";
  if (storedKey) $("#stationKey").value = storedKey;

  $("#previewSpendInput")?.addEventListener("input", (event) => {
    renderPreviewForSpend(event.target.value);
  });
  $("#stationRefreshBtn")?.addEventListener("click", () => {
    loadOverview().catch((err) => setStatus(err?.message || "Failed to load station telemetry.", true));
  });

  $("#stationLookupBtn")?.addEventListener("click", () => {
    loadSummary().catch((err) => setStatus(err?.message || "Failed to load balance.", true));
  });
  $("#stationClearBtn")?.addEventListener("click", clearKey);
  $("#stationKey")?.addEventListener("keydown", (event) => {
    if (event.key === "Enter") loadSummary().catch((err) => setStatus(err?.message || "Failed to load balance.", true));
  });

  loadOverview().catch((err) => {
    setStatus(err?.message || "Failed to load station telemetry.", true);
    loadConfig().catch((configErr) => setStatus(configErr?.message || "Failed to load station configuration.", true));
  });
}

boot();