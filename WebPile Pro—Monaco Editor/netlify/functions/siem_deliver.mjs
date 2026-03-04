import { handler as apiHandler } from "./api.mjs";

// This scheduled function calls the internal API route /siem/deliver for each org with config.
// Netlify scheduled functions invoke handler with a basic event; we implement a dedicated path for scheduled processing.
export async function handler(event, context) {
  // call api handler with a special path
  return apiHandler({ ...event, path: "/api/_scheduled/siem" }, context);
}
