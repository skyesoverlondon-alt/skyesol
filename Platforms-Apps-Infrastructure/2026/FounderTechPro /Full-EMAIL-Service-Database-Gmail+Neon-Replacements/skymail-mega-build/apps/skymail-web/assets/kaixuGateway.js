/*
  REQUIRED kAIxuGateway13 Client Module
  Base URL: https://kaixugateway13.netlify.app
  Non-stream POST: /.netlify/functions/gateway-chat
  Stream SSE POST: /.netlify/functions/gateway-stream
  Auth: Authorization: Bearer <KAIXU_VIRTUAL_KEY>
  Payload shape:
    { provider, model, messages:[{role,content}], max_tokens, temperature }
  Streaming: fetch + ReadableStream parsing. No EventSource.
*/
const KAIXU_BASE_URL = "https://kaixugateway13.netlify.app";

function kaixuKeyGet(){ return localStorage.getItem("KAIXU_VIRTUAL_KEY") || ""; }
function kaixuKeySet(v){ localStorage.setItem("KAIXU_VIRTUAL_KEY", v || ""); }

function remainingBudget(monthObj){
  if(!monthObj) return null;
  const cap = Number(monthObj.cap_cents ?? 0);
  const spent = Number(monthObj.spent_cents ?? 0);
  return cap - spent;
}

function mapGatewayError(status, data){
  if(status === 401) return { code:401, message:"Kaixu Key required (401). Enter your Kaixu Key to continue." };
  if(status === 402) return { code:402, message:"Monthly cap reached (402). Monthly cap reached — upgrade/top-up required." };
  if(status === 429) return { code:429, message:"Rate limited (429). Slow down and retry in a moment." };
  return { code: status, message: (data && data.error) ? data.error : ("Gateway error (HTTP " + status + ").") };
}

async function kaixuChat({ provider, model, messages, max_tokens=512, temperature=0.4, kaixuKey }){
  const key = kaixuKey || kaixuKeyGet();
  const res = await fetch(`${KAIXU_BASE_URL}/.netlify/functions/gateway-chat`, {
    method:"POST",
    headers:{
      "Content-Type":"application/json",
      "Authorization": `Bearer ${key}`
    },
    body: JSON.stringify({ provider, model, messages, max_tokens, temperature })
  });

  const text = await res.text();
  let data = null;
  try{ data = text ? JSON.parse(text) : null; }catch(e){ data = { error:"Non-JSON response", raw:text }; }

  if(!res.ok){
    const m = mapGatewayError(res.status, data);
    const err = new Error(m.message);
    err.status = res.status;
    err.data = data;
    throw err;
  }

  // Expected response: { output_text, usage:{...}, month:{...} }
  return data;
}

function parseSseFrames(chunkText, carry){
  // SSE frames are separated by \n\n (blank line). Return frames and new carry.
  const text = carry + chunkText;
  const parts = text.split(/\n\n/);
  const frames = parts.slice(0, -1);
  const rest = parts[parts.length - 1];
  return { frames, rest };
}

function parseSseFrame(frame){
  // Support standard SSE:
  // event: meta
  // data: {...}
  // Also support single-line shorthand:
  // meta: {...}
  const lines = frame.split(/\n/).map(l => l.trim()).filter(Boolean);
  let eventName = null;
  let dataLines = [];
  for(const line of lines){
    if(line.startsWith("event:")){
      eventName = line.slice(6).trim();
      continue;
    }
    if(line.startsWith("data:")){
      dataLines.push(line.slice(5).trim());
      continue;
    }
    const m = line.match(/^(meta|delta|done|error):\s*(.*)$/);
    if(m){
      eventName = m[1];
      dataLines.push(m[2]);
      continue;
    }
  }
  const dataStr = dataLines.join("\n").trim();
  if(!eventName) eventName = "message";
  let data = null;
  try{ data = dataStr ? JSON.parse(dataStr) : null; }catch(e){ data = { error:"Non-JSON SSE data", raw:dataStr }; }
  return { eventName, data };
}

async function kaixuStreamChat({ provider, model, messages, max_tokens=512, temperature=0.4, kaixuKey, onMeta, onDelta, onDone, onError }){
  const key = kaixuKey || kaixuKeyGet();

  const res = await fetch(`${KAIXU_BASE_URL}/.netlify/functions/gateway-stream`, {
    method:"POST",
    headers:{
      "Content-Type":"application/json",
      "Authorization": `Bearer ${key}`
    },
    body: JSON.stringify({ provider, model, messages, max_tokens, temperature })
  });

  if(!res.ok){
    let data = null;
    try{ data = await res.json(); }catch(e){}
    const m = mapGatewayError(res.status, data);
    const err = new Error(m.message);
    err.status = res.status;
    err.data = data;
    if(onError) onError({ error: err.message, status: err.status, data: err.data });
    throw err;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let carry = "";

  while(true){
    const { value, done } = await reader.read();
    if(done) break;
    const chunkText = decoder.decode(value, { stream:true });
    const { frames, rest } = parseSseFrames(chunkText, carry);
    carry = rest;

    for(const frame of frames){
      const { eventName, data } = parseSseFrame(frame);
      if(eventName === "meta"){
        onMeta && onMeta(data);
      }else if(eventName === "delta"){
        onDelta && onDelta(data);
      }else if(eventName === "done"){
        onDone && onDone(data);
      }else if(eventName === "error"){
        onError && onError(data);
      }
    }
  }
}

