import { normalizePath } from "./pushPathNormalize.js";

export function encodeURIComponentSafePath(pathWithLeadingSlash) {
  const p = normalizePath(pathWithLeadingSlash);
  const parts = p.slice(1).split("/").map((seg) => encodeURIComponent(seg));
  return parts.join("/");
}
