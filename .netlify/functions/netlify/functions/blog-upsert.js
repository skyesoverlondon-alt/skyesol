var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// netlify/functions/blog-upsert.mjs
var blog_upsert_exports = {};
__export(blog_upsert_exports, {
  handler: () => handler
});
module.exports = __toCommonJS(blog_upsert_exports);

// node_modules/@netlify/blobs/dist/chunk-SGXOM2EY.js
var NF_ERROR = "x-nf-error";
var NF_REQUEST_ID = "x-nf-request-id";
var BlobsInternalError = class extends Error {
  constructor(res) {
    let details = res.headers.get(NF_ERROR) || `${res.status} status code`;
    if (res.headers.has(NF_REQUEST_ID)) {
      details += `, ID: ${res.headers.get(NF_REQUEST_ID)}`;
    }
    super(`Netlify Blobs has generated an internal error (${details})`);
    this.name = "BlobsInternalError";
  }
};
var collectIterator = async (iterator) => {
  const result = [];
  for await (const item of iterator) {
    result.push(item);
  }
  return result;
};
var base64Decode = (input) => {
  const { Buffer: Buffer2 } = globalThis;
  if (Buffer2) {
    return Buffer2.from(input, "base64").toString();
  }
  return atob(input);
};
var base64Encode = (input) => {
  const { Buffer: Buffer2 } = globalThis;
  if (Buffer2) {
    return Buffer2.from(input).toString("base64");
  }
  return btoa(input);
};
var getEnvironment = () => {
  const { Deno, Netlify, process: process2 } = globalThis;
  return Netlify?.env ?? Deno?.env ?? {
    delete: (key) => delete process2?.env[key],
    get: (key) => process2?.env[key],
    has: (key) => Boolean(process2?.env[key]),
    set: (key, value) => {
      if (process2?.env) {
        process2.env[key] = value;
      }
    },
    toObject: () => process2?.env ?? {}
  };
};
var getEnvironmentContext = () => {
  const context = globalThis.netlifyBlobsContext || getEnvironment().get("NETLIFY_BLOBS_CONTEXT");
  if (typeof context !== "string" || !context) {
    return {};
  }
  const data = base64Decode(context);
  try {
    return JSON.parse(data);
  } catch {
  }
  return {};
};
var MissingBlobsEnvironmentError = class extends Error {
  constructor(requiredProperties) {
    super(
      `The environment has not been configured to use Netlify Blobs. To use it manually, supply the following properties when creating a store: ${requiredProperties.join(
        ", "
      )}`
    );
    this.name = "MissingBlobsEnvironmentError";
  }
};
var BASE64_PREFIX = "b64;";
var METADATA_HEADER_INTERNAL = "x-amz-meta-user";
var METADATA_HEADER_EXTERNAL = "netlify-blobs-metadata";
var METADATA_MAX_SIZE = 2 * 1024;
var encodeMetadata = (metadata) => {
  if (!metadata) {
    return null;
  }
  const encodedObject = base64Encode(JSON.stringify(metadata));
  const payload = `b64;${encodedObject}`;
  if (METADATA_HEADER_EXTERNAL.length + payload.length > METADATA_MAX_SIZE) {
    throw new Error("Metadata object exceeds the maximum size");
  }
  return payload;
};
var decodeMetadata = (header) => {
  if (!header || !header.startsWith(BASE64_PREFIX)) {
    return {};
  }
  const encodedData = header.slice(BASE64_PREFIX.length);
  const decodedData = base64Decode(encodedData);
  const metadata = JSON.parse(decodedData);
  return metadata;
};
var getMetadataFromResponse = (response) => {
  if (!response.headers) {
    return {};
  }
  const value = response.headers.get(METADATA_HEADER_EXTERNAL) || response.headers.get(METADATA_HEADER_INTERNAL);
  try {
    return decodeMetadata(value);
  } catch {
    throw new Error(
      "An internal error occurred while trying to retrieve the metadata for an entry. Please try updating to the latest version of the Netlify Blobs client."
    );
  }
};
var BlobsConsistencyError = class extends Error {
  constructor() {
    super(
      `Netlify Blobs has failed to perform a read using strong consistency because the environment has not been configured with a 'uncachedEdgeURL' property`
    );
    this.name = "BlobsConsistencyError";
  }
};
var DEFAULT_RETRY_DELAY = getEnvironment().get("NODE_ENV") === "test" ? 1 : 5e3;
var MIN_RETRY_DELAY = 1e3;
var MAX_RETRY = 5;
var RATE_LIMIT_HEADER = "X-RateLimit-Reset";
var fetchAndRetry = async (fetch, url, options, attemptsLeft = MAX_RETRY) => {
  try {
    const res = await fetch(url, options);
    if (attemptsLeft > 0 && (res.status === 429 || res.status >= 500)) {
      const delay = getDelay(res.headers.get(RATE_LIMIT_HEADER));
      await sleep(delay);
      return fetchAndRetry(fetch, url, options, attemptsLeft - 1);
    }
    return res;
  } catch (error) {
    if (attemptsLeft === 0) {
      throw error;
    }
    const delay = getDelay();
    await sleep(delay);
    return fetchAndRetry(fetch, url, options, attemptsLeft - 1);
  }
};
var getDelay = (rateLimitReset) => {
  if (!rateLimitReset) {
    return DEFAULT_RETRY_DELAY;
  }
  return Math.max(Number(rateLimitReset) * 1e3 - Date.now(), MIN_RETRY_DELAY);
};
var sleep = (ms) => new Promise((resolve) => {
  setTimeout(resolve, ms);
});
var SIGNED_URL_ACCEPT_HEADER = "application/json;type=signed-url";
var Client = class {
  constructor({ apiURL, consistency, edgeURL, fetch, region, siteID, token, uncachedEdgeURL }) {
    this.apiURL = apiURL;
    this.consistency = consistency ?? "eventual";
    this.edgeURL = edgeURL;
    this.fetch = fetch ?? globalThis.fetch;
    this.region = region;
    this.siteID = siteID;
    this.token = token;
    this.uncachedEdgeURL = uncachedEdgeURL;
    if (!this.fetch) {
      throw new Error(
        "Netlify Blobs could not find a `fetch` client in the global scope. You can either update your runtime to a version that includes `fetch` (like Node.js 18.0.0 or above), or you can supply your own implementation using the `fetch` property."
      );
    }
  }
  async getFinalRequest({
    consistency: opConsistency,
    key,
    metadata,
    method,
    parameters = {},
    storeName
  }) {
    const encodedMetadata = encodeMetadata(metadata);
    const consistency = opConsistency ?? this.consistency;
    let urlPath = `/${this.siteID}`;
    if (storeName) {
      urlPath += `/${storeName}`;
    }
    if (key) {
      urlPath += `/${key}`;
    }
    if (this.edgeURL) {
      if (consistency === "strong" && !this.uncachedEdgeURL) {
        throw new BlobsConsistencyError();
      }
      const headers = {
        authorization: `Bearer ${this.token}`
      };
      if (encodedMetadata) {
        headers[METADATA_HEADER_INTERNAL] = encodedMetadata;
      }
      if (this.region) {
        urlPath = `/region:${this.region}${urlPath}`;
      }
      const url2 = new URL(urlPath, consistency === "strong" ? this.uncachedEdgeURL : this.edgeURL);
      for (const key2 in parameters) {
        url2.searchParams.set(key2, parameters[key2]);
      }
      return {
        headers,
        url: url2.toString()
      };
    }
    const apiHeaders = { authorization: `Bearer ${this.token}` };
    const url = new URL(`/api/v1/blobs${urlPath}`, this.apiURL ?? "https://api.netlify.com");
    for (const key2 in parameters) {
      url.searchParams.set(key2, parameters[key2]);
    }
    if (this.region) {
      url.searchParams.set("region", this.region);
    }
    if (storeName === void 0 || key === void 0) {
      return {
        headers: apiHeaders,
        url: url.toString()
      };
    }
    if (encodedMetadata) {
      apiHeaders[METADATA_HEADER_EXTERNAL] = encodedMetadata;
    }
    if (method === "head" || method === "delete") {
      return {
        headers: apiHeaders,
        url: url.toString()
      };
    }
    const res = await this.fetch(url.toString(), {
      headers: { ...apiHeaders, accept: SIGNED_URL_ACCEPT_HEADER },
      method
    });
    if (res.status !== 200) {
      throw new BlobsInternalError(res);
    }
    const { url: signedURL } = await res.json();
    const userHeaders = encodedMetadata ? { [METADATA_HEADER_INTERNAL]: encodedMetadata } : void 0;
    return {
      headers: userHeaders,
      url: signedURL
    };
  }
  async makeRequest({
    body,
    consistency,
    headers: extraHeaders,
    key,
    metadata,
    method,
    parameters,
    storeName
  }) {
    const { headers: baseHeaders = {}, url } = await this.getFinalRequest({
      consistency,
      key,
      metadata,
      method,
      parameters,
      storeName
    });
    const headers = {
      ...baseHeaders,
      ...extraHeaders
    };
    if (method === "put") {
      headers["cache-control"] = "max-age=0, stale-while-revalidate=60";
    }
    const options = {
      body,
      headers,
      method
    };
    if (body instanceof ReadableStream) {
      options.duplex = "half";
    }
    return fetchAndRetry(this.fetch, url, options);
  }
};
var getClientOptions = (options, contextOverride) => {
  const context = contextOverride ?? getEnvironmentContext();
  const siteID = context.siteID ?? options.siteID;
  const token = context.token ?? options.token;
  if (!siteID || !token) {
    throw new MissingBlobsEnvironmentError(["siteID", "token"]);
  }
  const clientOptions = {
    apiURL: context.apiURL ?? options.apiURL,
    consistency: options.consistency,
    edgeURL: context.edgeURL ?? options.edgeURL,
    fetch: options.fetch,
    region: options.region,
    siteID,
    token,
    uncachedEdgeURL: context.uncachedEdgeURL ?? options.uncachedEdgeURL
  };
  return clientOptions;
};

// node_modules/@netlify/blobs/dist/main.js
var DEPLOY_STORE_PREFIX = "deploy:";
var LEGACY_STORE_INTERNAL_PREFIX = "netlify-internal/legacy-namespace/";
var SITE_STORE_PREFIX = "site:";
var Store = class _Store {
  constructor(options) {
    this.client = options.client;
    if ("deployID" in options) {
      _Store.validateDeployID(options.deployID);
      let name = DEPLOY_STORE_PREFIX + options.deployID;
      if (options.name) {
        name += `:${options.name}`;
      }
      this.name = name;
    } else if (options.name.startsWith(LEGACY_STORE_INTERNAL_PREFIX)) {
      const storeName = options.name.slice(LEGACY_STORE_INTERNAL_PREFIX.length);
      _Store.validateStoreName(storeName);
      this.name = storeName;
    } else {
      _Store.validateStoreName(options.name);
      this.name = SITE_STORE_PREFIX + options.name;
    }
  }
  async delete(key) {
    const res = await this.client.makeRequest({ key, method: "delete", storeName: this.name });
    if (![200, 204, 404].includes(res.status)) {
      throw new BlobsInternalError(res);
    }
  }
  async get(key, options) {
    const { consistency, type } = options ?? {};
    const res = await this.client.makeRequest({ consistency, key, method: "get", storeName: this.name });
    if (res.status === 404) {
      return null;
    }
    if (res.status !== 200) {
      throw new BlobsInternalError(res);
    }
    if (type === void 0 || type === "text") {
      return res.text();
    }
    if (type === "arrayBuffer") {
      return res.arrayBuffer();
    }
    if (type === "blob") {
      return res.blob();
    }
    if (type === "json") {
      return res.json();
    }
    if (type === "stream") {
      return res.body;
    }
    throw new BlobsInternalError(res);
  }
  async getMetadata(key, { consistency } = {}) {
    const res = await this.client.makeRequest({ consistency, key, method: "head", storeName: this.name });
    if (res.status === 404) {
      return null;
    }
    if (res.status !== 200 && res.status !== 304) {
      throw new BlobsInternalError(res);
    }
    const etag = res?.headers.get("etag") ?? void 0;
    const metadata = getMetadataFromResponse(res);
    const result = {
      etag,
      metadata
    };
    return result;
  }
  async getWithMetadata(key, options) {
    const { consistency, etag: requestETag, type } = options ?? {};
    const headers = requestETag ? { "if-none-match": requestETag } : void 0;
    const res = await this.client.makeRequest({
      consistency,
      headers,
      key,
      method: "get",
      storeName: this.name
    });
    if (res.status === 404) {
      return null;
    }
    if (res.status !== 200 && res.status !== 304) {
      throw new BlobsInternalError(res);
    }
    const responseETag = res?.headers.get("etag") ?? void 0;
    const metadata = getMetadataFromResponse(res);
    const result = {
      etag: responseETag,
      metadata
    };
    if (res.status === 304 && requestETag) {
      return { data: null, ...result };
    }
    if (type === void 0 || type === "text") {
      return { data: await res.text(), ...result };
    }
    if (type === "arrayBuffer") {
      return { data: await res.arrayBuffer(), ...result };
    }
    if (type === "blob") {
      return { data: await res.blob(), ...result };
    }
    if (type === "json") {
      return { data: await res.json(), ...result };
    }
    if (type === "stream") {
      return { data: res.body, ...result };
    }
    throw new Error(`Invalid 'type' property: ${type}. Expected: arrayBuffer, blob, json, stream, or text.`);
  }
  list(options = {}) {
    const iterator = this.getListIterator(options);
    if (options.paginate) {
      return iterator;
    }
    return collectIterator(iterator).then(
      (items) => items.reduce(
        (acc, item) => ({
          blobs: [...acc.blobs, ...item.blobs],
          directories: [...acc.directories, ...item.directories]
        }),
        { blobs: [], directories: [] }
      )
    );
  }
  async set(key, data, { metadata } = {}) {
    _Store.validateKey(key);
    const res = await this.client.makeRequest({
      body: data,
      key,
      metadata,
      method: "put",
      storeName: this.name
    });
    if (res.status !== 200) {
      throw new BlobsInternalError(res);
    }
  }
  async setJSON(key, data, { metadata } = {}) {
    _Store.validateKey(key);
    const payload = JSON.stringify(data);
    const headers = {
      "content-type": "application/json"
    };
    const res = await this.client.makeRequest({
      body: payload,
      headers,
      key,
      metadata,
      method: "put",
      storeName: this.name
    });
    if (res.status !== 200) {
      throw new BlobsInternalError(res);
    }
  }
  static formatListResultBlob(result) {
    if (!result.key) {
      return null;
    }
    return {
      etag: result.etag,
      key: result.key
    };
  }
  static validateKey(key) {
    if (key === "") {
      throw new Error("Blob key must not be empty.");
    }
    if (key.startsWith("/") || key.startsWith("%2F")) {
      throw new Error("Blob key must not start with forward slash (/).");
    }
    if (new TextEncoder().encode(key).length > 600) {
      throw new Error(
        "Blob key must be a sequence of Unicode characters whose UTF-8 encoding is at most 600 bytes long."
      );
    }
  }
  static validateDeployID(deployID) {
    if (!/^\w{1,24}$/.test(deployID)) {
      throw new Error(`'${deployID}' is not a valid Netlify deploy ID.`);
    }
  }
  static validateStoreName(name) {
    if (name.includes("/") || name.includes("%2F")) {
      throw new Error("Store name must not contain forward slashes (/).");
    }
    if (new TextEncoder().encode(name).length > 64) {
      throw new Error(
        "Store name must be a sequence of Unicode characters whose UTF-8 encoding is at most 64 bytes long."
      );
    }
  }
  getListIterator(options) {
    const { client, name: storeName } = this;
    const parameters = {};
    if (options?.prefix) {
      parameters.prefix = options.prefix;
    }
    if (options?.directories) {
      parameters.directories = "true";
    }
    return {
      [Symbol.asyncIterator]() {
        let currentCursor = null;
        let done = false;
        return {
          async next() {
            if (done) {
              return { done: true, value: void 0 };
            }
            const nextParameters = { ...parameters };
            if (currentCursor !== null) {
              nextParameters.cursor = currentCursor;
            }
            const res = await client.makeRequest({
              method: "get",
              parameters: nextParameters,
              storeName
            });
            const page = await res.json();
            if (page.next_cursor) {
              currentCursor = page.next_cursor;
            } else {
              done = true;
            }
            const blobs = (page.blobs ?? []).map(_Store.formatListResultBlob).filter(Boolean);
            return {
              done: false,
              value: {
                blobs,
                directories: page.directories ?? []
              }
            };
          }
        };
      }
    };
  }
};
var getStore = (input) => {
  if (typeof input === "string") {
    const clientOptions = getClientOptions({});
    const client = new Client(clientOptions);
    return new Store({ client, name: input });
  }
  if (typeof input?.name === "string") {
    const { name } = input;
    const clientOptions = getClientOptions(input);
    if (!name) {
      throw new MissingBlobsEnvironmentError(["name"]);
    }
    const client = new Client(clientOptions);
    return new Store({ client, name });
  }
  if (typeof input?.deployID === "string") {
    const clientOptions = getClientOptions(input);
    const { deployID } = input;
    if (!deployID) {
      throw new MissingBlobsEnvironmentError(["deployID"]);
    }
    const client = new Client(clientOptions);
    return new Store({ client, deployID });
  }
  throw new Error(
    "The `getStore` method requires the name of the store as a string or as the `name` property of an options object"
  );
};

// netlify/functions/_common.mjs
var STORE_NAME = process.env.BLOBS_STORE || "sol_growth";
var _textDecoder = typeof TextDecoder !== "undefined" ? new TextDecoder() : null;
function decodeValue(raw) {
  if (raw == null) return null;
  if (typeof raw === "string") return raw;
  if (raw instanceof Uint8Array) {
    return _textDecoder ? _textDecoder.decode(raw) : Buffer.from(raw).toString();
  }
  if (typeof raw === "object" && typeof raw.toString === "function") {
    return raw.toString();
  }
  return String(raw);
}
function wrapStore(base) {
  const fallback = {
    async getJSON() {
      return null;
    },
    async setJSON() {
      return;
    }
  };
  if (!base) return fallback;
  return {
    ...base,
    async getJSON(key) {
      const raw = await base.get(key);
      const text = decodeValue(raw);
      if (text == null) return null;
      try {
        return JSON.parse(text);
      } catch {
        return null;
      }
    },
    async setJSON(key, value) {
      const payload = JSON.stringify(value ?? null);
      await base.set(key, payload);
    }
  };
}
var cachedStore;
function store() {
  if (cachedStore) return cachedStore;
  try {
    const base = getStore(STORE_NAME);
    cachedStore = wrapStore(base);
    return cachedStore;
  } catch (err) {
    console.error("[-] Netlify Blobs unavailable", err?.message || err);
    cachedStore = wrapStore(null);
    return cachedStore;
  }
}
function json(statusCode, body, extraHeaders = {}) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      ...extraHeaders
    },
    body: JSON.stringify(body ?? null)
  };
}
function badRequest(message, details) {
  return json(400, { error: message || "Bad request", details });
}
function forbidden(message) {
  return json(403, { error: message || "Forbidden" });
}
function serverError(message, details) {
  return json(500, { error: message || "Server error", details });
}
function getUser(context) {
  return context?.clientContext?.user || null;
}
function userEmail(user) {
  const email = user?.email || user?.user_metadata?.email || "";
  return String(email || "").toLowerCase().trim();
}
function isAdmin(user) {
  const roles = user?.app_metadata?.roles;
  if (Array.isArray(roles) && roles.includes("admin")) return true;
  const allow = (process.env.ADMIN_EMAILS || "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
  if (!allow.length) return false;
  return allow.includes(userEmail(user));
}
function parseJsonBody(event) {
  if (!event?.body) return null;
  try {
    return JSON.parse(event.body);
  } catch {
    return null;
  }
}
function slugify(input) {
  const s = String(input || "").toLowerCase().replace(/[^a-z0-9\s-]/g, "").trim().replace(/\s+/g, "-").replace(/-+/g, "-").slice(0, 80);
  return s || `item-${Date.now()}`;
}
async function ensureSeed() {
  const s = store();
  const idx = await s.getJSON("blog:index").catch(() => null);
  if (!idx) {
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const seedPost = {
      slug: "welcome",
      title: "Field Notes: Welcome to the SOL Growth Platform",
      excerpt: "Blog + CMS + Vault + Monitoring are live when Netlify Functions + Blobs are deployed. This seed post proves the pipeline.",
      cover_image: null,
      tags: ["Ops", "Platform"],
      status: "published",
      published_at: now,
      updated_at: now,
      author: "Skyes Over London LC",
      content_md: [
        "## What this enables",
        "",
        "This website ships as a full growth platform:",
        "- **Blog publishing (CMS)** backed by Netlify Blobs",
        "- **Gated Client Vault** (Identity + Functions)",
        "- **Portal Status + Monitoring** backed by a portal inventory",
        "",
        "## Why Blobs",
        "",
        "Blobs gives you a simple key/value store without standing up a database, perfect for content + monitoring artifacts.",
        "",
        "## Next steps",
        "",
        "1) Enable Netlify Identity",
        "2) Set `ADMIN_EMAILS`",
        "3) Deploy Functions via Netlify CLI",
        "",
        "Then open **/admin.html** and start publishing."
      ].join("\n")
    };
    await s.setJSON("blog:post:welcome", seedPost);
    await s.setJSON("blog:index", {
      updated_at: now,
      posts: [
        {
          slug: seedPost.slug,
          title: seedPost.title,
          excerpt: seedPost.excerpt,
          cover_image: seedPost.cover_image,
          tags: seedPost.tags,
          status: seedPost.status,
          published_at: seedPost.published_at,
          updated_at: seedPost.updated_at,
          author: seedPost.author
        }
      ]
    });
  }
  const portals = await s.getJSON("portals:list").catch(() => null);
  if (!portals) {
    const seed = [
      {
        id: "sol-gateway",
        name: "SOLEnterprises.org",
        url: "https://solenterprises.org",
        path: "/",
        category: "Gateway",
        public: true,
        notes: "Primary gateway"
      },
      {
        id: "sol-nexusconnect",
        name: "SOL NexusConnect",
        url: "https://solenterprisesnexusconnect.netlify.app/",
        path: "/",
        category: "Hub",
        public: true,
        notes: "Command hub"
      },
      {
        id: "kaixu-ai-division",
        name: "Kaixu AI Division",
        url: "https://solenteaiskyes.netlify.app/",
        path: "/",
        category: "AI",
        public: true,
        notes: "AI platforms"
      }
    ];
    await s.setJSON("portals:list", { updated_at: (/* @__PURE__ */ new Date()).toISOString(), portals: seed });
  }
  const vault = await s.getJSON("vault:index").catch(() => null);
  if (!vault) {
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const doc = {
      id: "vault-welcome",
      title: "Client Vault: How to Use This",
      audience: "clients",
      tags: ["onboarding"],
      created_at: now,
      updated_at: now,
      content_md: [
        "## What this is",
        "",
        "The Vault contains gated docs and deliverables. Access is controlled by Identity tokens.",
        "",
        "## What belongs here",
        "",
        "- Proposals and SOWs\n- Architecture notes\n- Evidence packs\n- Operational playbooks"
      ].join("\n")
    };
    await s.setJSON(`vault:doc:${doc.id}`, doc);
    await s.setJSON("vault:index", { updated_at: now, docs: [{ id: doc.id, title: doc.title, audience: doc.audience, tags: doc.tags }] });
  }
}

// netlify/functions/blog-upsert.mjs
var handler = async (event, context) => {
  await ensureSeed();
  const user = getUser(context);
  if (!user) return forbidden("Missing Identity token");
  if (!isAdmin(user)) return forbidden("Not an admin");
  const body = parseJsonBody(event);
  const postIn = body?.post;
  if (!postIn) return badRequest("Missing post");
  const title = String(postIn.title || "").trim();
  const content = String(postIn.content_md || "").trim();
  if (!title) return badRequest("Title is required");
  if (!content) return badRequest("Body is required");
  const s = store();
  const slug = String(postIn.slug || "").trim() || slugify(title);
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const existing = await s.getJSON(`blog:post:${slug}`).catch(() => null);
  const created_at = existing?.created_at || now;
  const status = String(postIn.status || "draft").toLowerCase() === "published" ? "published" : "draft";
  const published_at = status === "published" ? existing?.published_at || now : existing?.published_at || null;
  const post = {
    slug,
    title,
    excerpt: String(postIn.excerpt || "").trim(),
    cover_image: postIn.cover_image ? String(postIn.cover_image).trim() : null,
    tags: Array.isArray(postIn.tags) ? postIn.tags.map((t) => String(t).trim()).filter(Boolean).slice(0, 12) : [],
    status,
    author: String(postIn.author || existing?.author || user.email || "Skyes Over London LC").trim(),
    content_md: content,
    created_at,
    updated_at: now,
    published_at
  };
  try {
    await s.setJSON(`blog:post:${slug}`, post);
    const idx = await s.getJSON("blog:index").catch(() => ({ posts: [] }));
    const posts = Array.isArray(idx?.posts) ? idx.posts : [];
    const next = posts.filter((p) => p.slug !== slug);
    next.push({
      slug: post.slug,
      title: post.title,
      excerpt: post.excerpt,
      cover_image: post.cover_image,
      tags: post.tags,
      status: post.status,
      published_at: post.published_at,
      updated_at: post.updated_at,
      author: post.author
    });
    next.sort((a, b) => new Date(b.published_at || b.updated_at || 0) - new Date(a.published_at || a.updated_at || 0));
    await s.setJSON("blog:index", { updated_at: now, posts: next });
    return json(200, { ok: true, slug });
  } catch (e) {
    return serverError("Failed to save post", String(e?.message || e));
  }
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  handler
});
