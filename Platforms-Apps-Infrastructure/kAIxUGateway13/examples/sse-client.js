const KAIXU_API_BASE = (process.env.KAIXU_API_BASE || "").replace(/\/+$/, "");
/**
 * Minimal SSE-over-fetch client for POST endpoints (works in browser).
 * Reads event/meta/delta/done frames from /.netlify/functions/gateway-stream
 */
export async function streamChat({ url, apiKey, payload, onDelta, onMeta, onDone, onError }) {
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "authorization": "Bearer " + apiKey,
      "content-type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  if (!res.ok) {
    const data = await res.json().catch(()=> ({}));
    throw new Error(data.error || ("HTTP " + res.status));
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";

  const emit = (event, data) => {
    if (event === "meta") onMeta?.(data);
    if (event === "delta") onDelta?.(data.text || "");
    if (event === "done") onDone?.(data);
    if (event === "error") onError?.(data);
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });

    // SSE frames separated by blank line
    const frames = buf.split("\n\n");
    buf = frames.pop() || "";

    for (const frame of frames) {
      const lines = frame.split("\n").filter(Boolean);
      let event = "message";
      let dataStr = "";
      for (const line of lines) {
        if (line.startsWith("event:")) event = line.slice(6).trim();
        if (line.startsWith("data:")) dataStr += line.slice(5).trim();
      }
      if (!dataStr) continue;
      try { emit(event, JSON.parse(dataStr)); } catch {}
    }
  }
}
