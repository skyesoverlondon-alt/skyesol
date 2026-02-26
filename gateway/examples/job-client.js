const KAIXU_API_BASE = (process.env.KAIXU_API_BASE || "").replace(/\/+$/, "");
// Example: enqueue a long job and poll until done.
// node examples/job-client.js
// Requires Node 18+ (built-in fetch).

const BASE = process.env.GW_BASE || "http://localhost:8888"; // netlify dev default
const KEY = process.env.GW_KEY || "";
if (!KEY) throw new Error("Set GW_KEY=...");

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function main(){
  const submit = await fetch(`${BASE}/.netlify/functions/gateway-job-submit`, {
    method: "POST",
    headers: { "authorization": `Bearer ${KEY}`, "content-type":"application/json" },
    body: JSON.stringify({
      provider: "openai",
      model: "gpt-4.1-mini",
      messages: [{ role:"user", content:"Write a very long response (code + explanation) about serverless timeouts." }],
      max_tokens: 8192,
      temperature: 0.7
    })
  }).then(r=>r.json());

  console.log("Submit:", submit);

  while(true){
    const st = await fetch(submit.status_url, { headers: { "authorization": `Bearer ${KEY}` } }).then(r=>r.json());
    console.log("Status:", st.job.status, "output_len:", st.job.output_len);
    if (st.job.status === "succeeded") break;
    if (st.job.status === "failed") throw new Error(st.job.error || "failed");
    await sleep(2000);
  }

  const res = await fetch(submit.result_url, { headers: { "authorization": `Bearer ${KEY}` } }).then(r=>r.json());
  console.log("Result usage:", res.usage);
  console.log("Output (first 500 chars):", (res.output_text||"").slice(0,500));
}

main().catch(e=>{ console.error(e); process.exit(1); });
