export function normalizePath(input) {
  let p = String(input || "").trim();

  // Normalize slashes
  p = p.replace(/\\/g, "/");

  // Disallow URL fragments/queries
  if (p.includes("#") || p.includes("?")) {
    const err = new Error("File paths must not include '#' or '?'");
    err.code = "BAD_PATH";
    err.status = 400;
    throw err;
  }

  // Force absolute
  if (!p.startsWith("/")) p = "/" + p;

  // Collapse duplicate slashes
  p = "/" + p.slice(1).replace(/\/{2,}/g, "/");

  // No control chars
  if (/[\x00-\x1F\x7F]/.test(p)) {
    const err = new Error("File path contains control characters");
    err.code = "BAD_PATH";
    err.status = 400;
    throw err;
  }

  // No trailing slash (files only)
  if (p.length > 1 && p.endsWith("/")) {
    const err = new Error("File path must not end with '/'");
    err.code = "BAD_PATH";
    err.status = 400;
    throw err;
  }

  // Forbid traversal / dot segments
  const segs = p.split("/");
  for (const seg of segs) {
    if (seg === ".." || seg === ".") {
      const err = new Error("File path must not include '.' or '..' segments");
      err.code = "BAD_PATH";
      err.status = 400;
      throw err;
    }
    // Forbid Windows-reserved and other dangerous characters in segments
    if (/[<>:"|*]/.test(seg)) {
      const err = new Error("File path contains invalid characters");
      err.code = "BAD_PATH";
      err.status = 400;
      throw err;
    }
  }

  // Reasonable length guard
  if (p.length > 1024) {
    const err = new Error("File path too long");
    err.code = "BAD_PATH";
    err.status = 400;
    throw err;
  }

  return p;
}
