// Placeholder reading-augmented-generation helpers used by legacy brain.js implementation.
// The real implementations may live elsewhere; these stubs simply throw if called.

export function hybrid() {
  throw new Error("rag.hybrid() not implemented");
}

export function getRecentMessages(...args) {
  throw new Error("rag.getRecentMessages() not implemented");
}

export function buildRagPacket(...args) {
  throw new Error("rag.buildRagPacket() not implemented");
}
