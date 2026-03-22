// SkyeLeticX Global Navigation (static sites, Netlify Drop friendly)
(function () {
  const NAV_ID = "skyeletix-global-nav";

  // Avoid double-inject
  if (document.getElementById(NAV_ID)) return;

  const isIntro = document.body && (document.body.getAttribute("data-intro") === "1");
  const navHeight = 72;

  // Light DOM padding (skip for intro)
  if (!isIntro) {
    const padStyle = document.createElement("style");
    padStyle.setAttribute("data-skyeletix-nav-pad", "1");
    padStyle.textContent = `
      :root{ --skyeletix-nav-h: ${navHeight}px; }
      body{ padding-top: var(--skyeletix-nav-h); }
      @media (max-width: 520px){ body{ padding-top: ${navHeight + 6}px; } }
    `;
    document.head.appendChild(padStyle);
  }

  // Hide the first primary nav if present (keep sidebar navs)
  const firstNav = document.querySelector("nav");
  if (firstNav && !firstNav.classList.contains("sidebar-nav") && firstNav.id !== NAV_ID) {
    firstNav.style.display = "none";
  }

  // Host element
  const host = document.createElement("div");
  host.id = NAV_ID;
  host.style.position = "fixed";
  host.style.top = "0";
  host.style.left = "0";
  host.style.right = "0";
  host.style.zIndex = "9999";
  host.style.pointerEvents = "auto";

  // Shadow DOM to avoid CSS collisions
  const shadow = host.attachShadow({ mode: "open" });

  const items = [
    { label: "Home", href: "/home.html" },
    { label: "How It Works", href: "/how-it-works.html" },
    { label: "About", href: "/about.html" },
    { label: "Founder", href: "/about-founder.html" },
    { label: "Arizona HQ", href: "/arizona-hq.html" },
    { label: "Players", href: "/players.html" },
    { label: "Owners", href: "/owners-intake.html" },
    { label: "Championships", href: "/championships.html" },
    { label: "Editorial", href: "/skyeletes-editorial.html" },
    { label: "Coach Smith", href: "/coach-smith/index.html" },
    { label: "League Office", href: "/owner-dashboard.html" },
    { label: "Sitemap", href: "/sitemap.html" }
  ];

  const pathname = (location.pathname || "/").toLowerCase();

  const style = document.createElement("style");
  style.textContent = `
    :host{ all: initial; }
    *{ box-sizing: border-box; }
    a{ color: inherit; text-decoration: none; }
    .bar{
      height: ${navHeight}px;
      padding: 0 14px;
      display:flex;
      align-items:center;
      justify-content:space-between;
      gap: 12px;
      background: rgba(10,10,18,0.78);
      backdrop-filter: blur(14px);
      -webkit-backdrop-filter: blur(14px);
      border-bottom: 1px solid rgba(255,255,255,0.10);
      font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, "Apple Color Emoji","Segoe UI Emoji";
      color: #fff;
    }
    .left{ display:flex; align-items:center; gap: 10px; min-width: 240px; }
    .logo{
      width: 42px; height: 42px;
      border-radius: 12px;
      box-shadow: 0 0 0 1px rgba(255,255,255,0.10), 0 10px 30px rgba(140, 60, 255, 0.18);
    }
    .brand{ display:flex; flex-direction:column; line-height: 1.1; }
    .brand .name{ font-size: 15px; font-weight: 800; letter-spacing: 0.02em; }
    .brand .sub{ font-size: 12px; opacity: 0.78; }

    .links{ display:flex; align-items:center; gap: 10px; flex-wrap: wrap; justify-content: center; }
    .link{
      font-size: 12.5px;
      padding: 8px 10px;
      border-radius: 12px;
      border: 1px solid rgba(255,255,255,0.10);
      background: rgba(255,255,255,0.04);
      transition: transform .12s ease, background .12s ease, border-color .12s ease;
      white-space: nowrap;
    }
    .link:hover{ transform: translateY(-1px); background: rgba(255,255,255,0.08); border-color: rgba(255,255,255,0.18); }
    .link.active{ background: rgba(175, 110, 255, 0.18); border-color: rgba(175, 110, 255, 0.40); }

    .right{ display:flex; align-items:center; gap: 10px; min-width: 210px; justify-content: flex-end; }
    .cta{
      font-size: 12.5px;
      padding: 10px 12px;
      border-radius: 14px;
      border: 1px solid rgba(255, 215, 110, 0.35);
      background: rgba(255, 215, 110, 0.10);
      box-shadow: 0 10px 30px rgba(255, 215, 110, 0.10);
      font-weight: 800;
    }
    .cta:hover{ background: rgba(255, 215, 110, 0.16); }

    .burger{
      display:none;
      width: 42px; height: 42px;
      border-radius: 12px;
      border: 1px solid rgba(255,255,255,0.10);
      background: rgba(255,255,255,0.04);
      color: #fff;
      cursor: pointer;
      align-items:center;
      justify-content:center;
      font-size: 18px;
    }

    .drawer{
      display:none;
      position: fixed;
      top: ${navHeight}px;
      left: 0;
      right: 0;
      background: rgba(10,10,18,0.94);
      border-bottom: 1px solid rgba(255,255,255,0.10);
      backdrop-filter: blur(14px);
      -webkit-backdrop-filter: blur(14px);
      padding: 12px;
    }
    .drawer.open{ display:block; }
    .drawer .grid{
      display:grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 10px;
    }
    .drawer .grid a{ text-align:center; }

    @media (max-width: 980px){
      .links{ display:none; }
      .burger{ display:flex; }
      .right{ min-width: auto; }
    }
  `;

  const logoUrl = "https://cdn1.sharemyimage.com/2026/02/09/SkyeLeticX_Badge_transparent_2048_png8.png";

  const bar = document.createElement("div");
  bar.className = "bar";

  const left = document.createElement("div");
  left.className = "left";
  left.innerHTML = `
    <a href="/home.html" aria-label="SkyeLeticX Home" style="display:flex;align-items:center;gap:10px;">
      <img class="logo" src="${logoUrl}" alt="SkyeLeticX Badge" />
      <div class="brand">
        <div class="name">SkyeLeticX</div>
        <div class="sub">Premium Under-6'0&quot; League</div>
      </div>
    </a>
  `;

  const links = document.createElement("div");
  links.className = "links";

  for (const it of items) {
    const a = document.createElement("a");
    a.className = "link";
    a.href = it.href;
    a.textContent = it.label;

    const isActive =
      (it.href === "/home.html" && (pathname === "/home.html" || pathname === "/home" || pathname === "/")) ||
      (pathname === it.href.toLowerCase());

    if (isActive && !isIntro) a.classList.add("active");

    links.appendChild(a);
  }

  const right = document.createElement("div");
  right.className = "right";

  const cta = document.createElement("a");
  cta.className = "cta";
  cta.href = "/players.html";
  cta.textContent = "Register / Join";

  const burger = document.createElement("button");
  burger.className = "burger";
  burger.type = "button";
  burger.setAttribute("aria-label", "Open menu");
  burger.textContent = "≡";

  right.appendChild(cta);
  right.appendChild(burger);

  const drawer = document.createElement("div");
  drawer.className = "drawer";
  drawer.innerHTML = `<div class="grid"></div>`;
  const grid = drawer.querySelector(".grid");

  for (const it of items) {
    const a = document.createElement("a");
    a.className = "link";
    a.href = it.href;
    a.textContent = it.label;
    grid.appendChild(a);
  }

  burger.addEventListener("click", () => {
    drawer.classList.toggle("open");
  });

  // Close drawer on navigation
  drawer.addEventListener("click", (e) => {
    const t = e.target;
    if (t && t.tagName === "A") drawer.classList.remove("open");
  });

  shadow.appendChild(style);
  bar.appendChild(left);
  bar.appendChild(links);
  bar.appendChild(right);
  shadow.appendChild(bar);
  shadow.appendChild(drawer);

  // mount
  document.body.insertBefore(host, document.body.firstChild);
})();
