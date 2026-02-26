function esc(v) {
  if (v === null || v === undefined) return "";
  const s = String(v);
  if (/[\n\r,"]/.test(s)) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

export function toCsv({ header, rows }) {
  const lines = [];
  if (header && header.length) lines.push(header.map(esc).join(","));
  for (const r of rows) {
    lines.push(r.map(esc).join(","));
  }
  return lines.join("\n") + "\n";
}
