// Stub gateway client for legacy brain.js may import from
// "../../lib/gatewayClient.js".  Actual gateway functions are maintained under _lib or
// other packages; we provide placeholders for build compatibility.

export function gatewayChat() {
  throw new Error("gatewayChat() not implemented");
}

export function gatewayEmbed() {
  throw new Error("gatewayEmbed() not implemented");
}
