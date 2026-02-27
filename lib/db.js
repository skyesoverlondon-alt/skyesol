// Legacy wrapper for ../../lib/db.js imports in Netlify functions.
// Re-export everything from the current _lib version to avoid duplication.

export * from "../netlify/functions/_lib/db.js";
