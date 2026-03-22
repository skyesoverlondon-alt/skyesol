(function(){
  const SERVICE_WORKER_PATH = "/access-222/service-worker.js";
  const CHECKOUT_FALLBACK = "https://example.com/your-stripe-payment-link";
  const body = document.body;
  const checkout = (window.SOL_CHECKOUT_URL || body.getAttribute("data-checkout") || CHECKOUT_FALLBACK).trim();
  const checkoutBtn = document.getElementById("checkoutBtn");
  if (checkoutBtn && checkout) checkoutBtn.setAttribute("href", checkout);

  const year = document.getElementById("year");
  if (year) year.textContent = String(new Date().getFullYear());

  document.addEventListener("click", (e) => {
    const a = e.target.closest && e.target.closest('a[href^="#"]');
    if (!a) return;
    const id = a.getAttribute("href").slice(1);
    const el = document.getElementById(id);
    if (!el) return;
    e.preventDefault();
    el.scrollIntoView({ behavior: "smooth", block: "start" });
  });

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => navigator.serviceWorker.register(SERVICE_WORKER_PATH).catch(()=>{}));
  }
})();
