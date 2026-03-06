(function () {
  const APPS = [
    { href: "./index.html", label: "Suite Hub" },
    { href: "./SkyeBookX-Cloud-Edition.html", label: "SkyeBookX Cloud" },
    { href: "./kAIxuAtlas.html", label: "kAIxu Atlas" },
    { href: "./kAIxuAtmos.html", label: "kAIxu Atmos" },
    { href: "./kAIxuBestiary.html", label: "kAIxu Bestiary" },
    { href: "./kAIxuBlueprint.html", label: "kAIxu Blueprint" },
    { href: "./kAIxuChronos.html", label: "kAIxu Chronos" },
    { href: "./kAIxuCodex.html", label: "kAIxu Codex" },
    { href: "./kAIxuCodexv2.html", label: "kAIxu Codex v2" },
    { href: "./kAIxuFaction.html", label: "kAIxu Faction" },
    { href: "./kAIxuForge.html", label: "kAIxu Forge" },
    { href: "./kAIxuGig.html", label: "kAIxu Gig" },
    { href: "./kAIxuGrimoire.html", label: "kAIxu Grimoire" },
    { href: "./kAIxuLexicon.html", label: "kAIxu Lexicon" },
    { href: "./kAIxuMatrix.html", label: "kAIxu Matrix" },
    { href: "./kAIxuMythos.html", label: "kAIxu Mythos" },
    { href: "./kAIxuPersona.html", label: "kAIxu Persona" },
    { href: "./kAIxuPress.html", label: "kAIxu Press" },
    { href: "./kAIxuPrime.html", label: "kAIxu Prime" },
    { href: "./kAIxuQuest.html", label: "kAIxu Quest" },
    { href: "./kAIxuRadio.html", label: "kAIxu Radio" },
    { href: "./kAIxuScript.html", label: "kAIxu Script" },
    { href: "./kAIxuSonic.html", label: "kAIxu Sonic" },
    { href: "./kAIxuTerminal.html", label: "kAIxu Terminal" },
    { href: "./kAIxuVision.html", label: "kAIxu Vision" },
    { href: "./kAIxu\Catalyst.html", label: "kAIxu Catalyst" }
  ];

  const SUITE_APP_NAME = "SkyeBookx-Pro-Suite";
  const SUITE_BUILD = "2026-foundertechpro";
  const GATEWAY_CHAT = "/.netlify/functions/gateway-chat";
  const PIXEL_PNG_B64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wn7L3kAAAAASUVORK5CYII=";

  const currentFile = decodeURIComponent((location.pathname.split("/").pop() || "index.html"));
  const currentIdx = Math.max(0, APPS.findIndex((a) => decodeURIComponent(a.href.replace("./", "")) === currentFile));

  function addDock() {
    const prev = APPS[(currentIdx - 1 + APPS.length) % APPS.length];
    const next = APPS[(currentIdx + 1) % APPS.length];

    const wrap = document.createElement("aside");
    wrap.id = "suiteNavDock";
    wrap.style.cssText = [
      "position:fixed",
      "right:14px",
      "bottom:14px",
      "z-index:99999",
      "width:min(280px,84vw)",
      "padding:10px",
      "border-radius:12px",
      "background:rgba(8,10,18,.92)",
      "border:1px solid rgba(255,255,255,.16)",
      "box-shadow:0 16px 42px rgba(0,0,0,.45)",
      "backdrop-filter:blur(12px)",
      "font-family:Inter,system-ui,sans-serif"
    ].join(";");

    wrap.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:8px;">
        <strong style="font-size:11px;letter-spacing:.05em;color:#f8fafc;text-transform:uppercase;">Suite Navigator</strong>
        <button id="suiteSetKey" type="button" style="font-size:10px;padding:4px 8px;border-radius:999px;border:1px solid rgba(255,255,255,.22);background:#111827;color:#fde68a;cursor:pointer;">Set Kaixu Key</button>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:6px;">
        <a href="/index.html" style="text-decoration:none;text-align:center;font-size:11px;padding:7px 8px;border-radius:8px;background:#111827;border:1px solid rgba(255,255,255,.12);color:#f8fafc;">Main Site</a>
        <a href="./index.html" style="text-decoration:none;text-align:center;font-size:11px;padding:7px 8px;border-radius:8px;background:#111827;border:1px solid rgba(255,255,255,.12);color:#f8fafc;">Suite Hub</a>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:6px;">
        <a href="${prev.href}" style="text-decoration:none;text-align:center;font-size:11px;padding:7px 8px;border-radius:8px;background:#0b1220;border:1px solid rgba(99,102,241,.4);color:#c7d2fe;">Prev</a>
        <a href="${next.href}" style="text-decoration:none;text-align:center;font-size:11px;padding:7px 8px;border-radius:8px;background:#0b1220;border:1px solid rgba(99,102,241,.4);color:#c7d2fe;">Next</a>
      </div>
      <select id="suiteAppJump" style="width:100%;font-size:11px;padding:7px;border-radius:8px;background:#0f172a;color:#f8fafc;border:1px solid rgba(255,255,255,.16)"></select>
      <div id="suiteNavStatus" style="margin-top:6px;font-size:10px;color:#94a3b8;"></div>
    `;

    document.body.appendChild(wrap);

    const sel = wrap.querySelector("#suiteAppJump");
    APPS.forEach((app, idx) => {
      const opt = document.createElement("option");
      opt.value = app.href;
      opt.textContent = `${idx === currentIdx ? "● " : ""}${app.label}`;
      if (idx === currentIdx) opt.selected = true;
      sel.appendChild(opt);
    });
    sel.addEventListener("change", () => {
      if (sel.value) location.href = sel.value;
    });

    const keyBtn = wrap.querySelector("#suiteSetKey");
    const status = wrap.querySelector("#suiteNavStatus");

    function refreshKeyStatus() {
      const key = (localStorage.getItem("KAIXU_VIRTUAL_KEY") || "").trim();
      status.textContent = key ? `Kaixu Key loaded (${key.slice(0, 8)}...)` : "Kaixu Key not set";
      status.style.color = key ? "#86efac" : "#fca5a5";
    }

    keyBtn.addEventListener("click", () => {
      const current = (localStorage.getItem("KAIXU_VIRTUAL_KEY") || "").trim();
      const nextKey = prompt("Enter KAIXU_VIRTUAL_KEY (kx_live_...)", current);
      if (nextKey === null) return;
      localStorage.setItem("KAIXU_VIRTUAL_KEY", nextKey.trim());
      refreshKeyStatus();
    });

    refreshKeyStatus();
  }

  function toGatewayHeaders(originalHeaders) {
    const h = new Headers(originalHeaders || {});
    if (!h.get("authorization")) {
      const key = (localStorage.getItem("KAIXU_VIRTUAL_KEY") || "").trim();
      if (key) h.set("authorization", `Bearer ${key}`);
    }
    if (!h.get("x-kaixu-app")) h.set("x-kaixu-app", SUITE_APP_NAME);
    if (!h.get("x-kaixu-build")) h.set("x-kaixu-build", SUITE_BUILD);
    h.set("content-type", "application/json");
    return h;
  }

  function normalizeLegacyBody(raw) {
    const body = raw && typeof raw === "object" ? raw : {};

    if (Array.isArray(body.messages) || body.provider) {
      return {
        kind: "chat",
        payload: {
          provider: body.provider || "gemini",
          model: body.model || "gemini-2.5-flash",
          messages: Array.isArray(body.messages) ? body.messages : [{ role: "user", content: String(body.prompt || "") }],
          max_tokens: body.max_tokens || body.maxTokens || 900,
          temperature: body.temperature == null ? 0.7 : body.temperature
        }
      };
    }

    if (Array.isArray(body.contents)) {
      const userText = body.contents
        .flatMap((c) => Array.isArray(c.parts) ? c.parts : [])
        .map((p) => p && p.text ? String(p.text) : "")
        .filter(Boolean)
        .join("\n");
      return {
        kind: "gemini-chat",
        payload: {
          provider: "gemini",
          model: "gemini-2.5-flash",
          messages: [{ role: "user", content: userText || "Generate output" }],
          max_tokens: 900,
          temperature: 0.7
        }
      };
    }

    if ((body.model && /dall-e|imagen/i.test(String(body.model))) || body.prompt) {
      return { kind: "image", payload: body };
    }

    if ((body.model && /tts|speech/i.test(String(body.model))) || body.input) {
      return { kind: "audio", payload: body };
    }

    return {
      kind: "chat",
      payload: {
        provider: "gemini",
        model: "gemini-2.5-flash",
        messages: [{ role: "user", content: JSON.stringify(body) }],
        max_tokens: 900,
        temperature: 0.7
      }
    };
  }

  function jsonResponse(obj, status) {
    return new Response(JSON.stringify(obj), {
      status: status || 200,
      headers: { "content-type": "application/json" }
    });
  }

  function syntheticAudioResponse() {
    // 0.1s mono WAV silence
    const wavB64 = "UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=";
    const bin = atob(wavB64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    const blob = new Blob([bytes], { type: "audio/wav" });
    return new Response(blob, { status: 200, headers: { "content-type": "audio/wav" } });
  }

  const originalFetch = window.fetch.bind(window);

  window.fetch = async function (input, init) {
    const reqUrl = typeof input === "string" ? input : (input && input.url) || "";
    const isGatewayChat = reqUrl.includes(GATEWAY_CHAT);
    if (!isGatewayChat) {
      return originalFetch(input, init);
    }

    let raw = {};
    try {
      raw = init && init.body ? JSON.parse(init.body) : {};
    } catch {
      raw = {};
    }

    const legacy = normalizeLegacyBody(raw);

    if (legacy.kind === "image") {
      if (raw && raw.response_format === "b64_json") {
        return jsonResponse({ data: [{ b64_json: PIXEL_PNG_B64 }] }, 200);
      }
      return jsonResponse({ predictions: [{ bytesBase64Encoded: PIXEL_PNG_B64 }] }, 200);
    }

    if (legacy.kind === "audio") {
      return syntheticAudioResponse();
    }

    const headers = toGatewayHeaders(init && init.headers ? init.headers : (input && input.headers));
    const res = await originalFetch(GATEWAY_CHAT, {
      method: "POST",
      headers,
      body: JSON.stringify(legacy.payload)
    });

    if (!res.ok) return res;

    const data = await res.json().catch(() => ({}));
    const text = data.output_text || "";

    if (legacy.kind === "gemini-chat") {
      return jsonResponse({
        candidates: [
          {
            content: {
              parts: [{ text }]
            }
          }
        ]
      }, 200);
    }

    return jsonResponse({
      choices: [
        {
          message: { content: text }
        }
      ]
    }, 200);
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", addDock);
  } else {
    addDock();
  }
})();
