const http = require("node:http");
const fs = require("node:fs");
const fsp = require("node:fs/promises");
const path = require("node:path");
const { Readable } = require("node:stream");

const ROOT_DIR = __dirname;
const BODY_LIMIT_BYTES = 2 * 1024 * 1024;

loadDotEnv(path.join(ROOT_DIR, ".env"));

const PORT = Number.parseInt(process.env.PORT || "5173", 10) || 5173;

const mimeTypes = new Map([
  [".css", "text/css; charset=utf-8"],
  [".html", "text/html; charset=utf-8"],
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".png", "image/png"],
  [".txt", "text/plain; charset=utf-8"],
  [".webp", "image/webp"],
  [".woff", "font/woff"],
  [".woff2", "font/woff2"],
]);

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
    if (url.pathname.startsWith("/api/")) {
      await handleApi(req, res, url);
      return;
    }
    await serveStatic(res, url.pathname);
  } catch (error) {
    console.error("[server]", error);
    sendJson(res, error.statusCode || 500, {
      error: error.statusCode ? error.message : "Internal server error",
    });
  }
});

server.listen(PORT, () => {
  console.log(`RPUI is running at http://localhost:${PORT}`);
});

async function handleApi(req, res, url) {
  if (url.pathname === "/api/config" && req.method === "GET") {
    sendJson(res, 200, getPublicConfig());
    return;
  }

  if (url.pathname === "/api/config" && req.method === "POST") {
    const body = await readJsonBody(req);
    const updates = buildEnvUpdates(body);
    if (!Object.keys(updates).length) {
      sendJson(res, 400, { error: "No supported config fields were provided" });
      return;
    }
    await writeDotEnvUpdates(path.join(ROOT_DIR, ".env"), updates);
    sendJson(res, 200, getPublicConfig());
    return;
  }

  if (url.pathname === "/api/models" && req.method === "GET") {
    await proxyUpstream(req, res, "/models");
    return;
  }

  if (url.pathname === "/api/chat/completions" && req.method === "POST") {
    await proxyUpstream(req, res, "/chat/completions");
    return;
  }

  if (url.pathname === "/api/searxng/search" && req.method === "GET") {
    await proxySearxngSearch(res, url);
    return;
  }

  sendJson(res, 404, { error: "API route not found" });
}

function getPublicConfig() {
  return {
    available: true,
    apiConfigured: hasUpstreamApiConfig(),
    apiBaseUrl: normalizeBaseUrl(process.env.OPENAI_API_BASE_URL || ""),
    defaultModel: process.env.OPENAI_MODEL || "",
    searxngConfigured: Boolean(process.env.SEARXNG_URL),
    searxngUrl: normalizeUrl(process.env.SEARXNG_URL || ""),
    features: ["api-proxy", "chat-stream", "models", "searxng-proxy", "env-write"],
  };
}

function buildEnvUpdates(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) return {};
  const updates = {};
  if (Object.hasOwn(body, "apiBaseUrl") || Object.hasOwn(body, "apiUrl")) {
    const apiBaseUrl = normalizeBaseUrl(body.apiBaseUrl || body.apiUrl || "");
    updates.OPENAI_API_BASE_URL = apiBaseUrl;
  }
  if (Object.hasOwn(body, "apiKey")) {
    updates.OPENAI_API_KEY = String(body.apiKey || "").trim();
  }
  if (Object.hasOwn(body, "defaultModel") || Object.hasOwn(body, "model")) {
    updates.OPENAI_MODEL = String(body.defaultModel || body.model || "").trim();
  }
  if (Object.hasOwn(body, "searxngUrl")) {
    updates.SEARXNG_URL = normalizeUrl(body.searxngUrl || "");
  }
  return updates;
}

async function proxyUpstream(req, res, apiPath) {
  const baseUrl = normalizeBaseUrl(process.env.OPENAI_API_BASE_URL || "");
  const apiKey = process.env.OPENAI_API_KEY || "";
  if (!baseUrl || !apiKey) {
    sendJson(res, 503, {
      error: "Server API is not configured. Set OPENAI_API_BASE_URL and OPENAI_API_KEY in .env.",
    });
    return;
  }

  const body = req.method === "GET" ? undefined : await readRequestBody(req);
  const upstreamResponse = await fetch(`${baseUrl}${apiPath}`, {
    method: req.method,
    headers: {
      Accept: req.headers.accept || "application/json",
      "Content-Type": req.headers["content-type"] || "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body,
  });

  res.writeHead(upstreamResponse.status, {
    "Content-Type": upstreamResponse.headers.get("content-type") || "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });

  if (!upstreamResponse.body) {
    res.end(await upstreamResponse.text());
    return;
  }

  Readable.fromWeb(upstreamResponse.body).pipe(res);
}

async function proxySearxngSearch(res, url) {
  const query = url.searchParams.get("q") || "";
  const rawBaseUrl = url.searchParams.get("url") || process.env.SEARXNG_URL || "";
  if (!query.trim()) {
    sendJson(res, 400, { error: "Missing q parameter" });
    return;
  }
  if (!rawBaseUrl.trim()) {
    sendJson(res, 503, { error: "SearXNG URL is not configured" });
    return;
  }

  const baseUrl = normalizeUrl(rawBaseUrl);
  if (!/^https?:\/\//i.test(baseUrl)) {
    sendJson(res, 400, { error: "SearXNG URL must start with http:// or https://" });
    return;
  }

  const upstreamUrl = new URL("/search", baseUrl);
  upstreamUrl.searchParams.set("q", query);
  upstreamUrl.searchParams.set("format", "json");
  upstreamUrl.searchParams.set("language", url.searchParams.get("language") || "ru");
  upstreamUrl.searchParams.set("safesearch", url.searchParams.get("safesearch") || "0");

  const upstreamResponse = await fetch(upstreamUrl, {
    headers: { Accept: "application/json" },
  });
  const data = await upstreamResponse.text();
  res.writeHead(upstreamResponse.status, {
    "Content-Type": upstreamResponse.headers.get("content-type") || "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  res.end(data);
}

async function serveStatic(res, pathname) {
  const normalizedPathname = decodeURIComponent(pathname.split("?")[0] || "/");
  if (normalizedPathname.split("/").some((segment) => segment.startsWith("."))) {
    sendText(res, 404, "Not found");
    return;
  }
  const requestedPath = normalizedPathname === "/" ? "/index.html" : normalizedPathname;
  if (!isPublicAssetPath(requestedPath)) {
    sendText(res, 404, "Not found");
    return;
  }
  const filePath = path.resolve(ROOT_DIR, `.${requestedPath}`);
  if (!filePath.startsWith(ROOT_DIR + path.sep)) {
    sendText(res, 403, "Forbidden");
    return;
  }

  const stat = await fsp.stat(filePath).catch(() => null);
  if (!stat || !stat.isFile()) {
    sendText(res, 404, "Not found");
    return;
  }

  res.writeHead(200, {
    "Content-Type": mimeTypes.get(path.extname(filePath).toLowerCase()) || "application/octet-stream",
    "Cache-Control": "no-store",
  });
  fs.createReadStream(filePath).pipe(res);
}

function isPublicAssetPath(requestedPath) {
  return (
    requestedPath === "/index.html" ||
    requestedPath === "/app.js" ||
    requestedPath === "/styles.css" ||
    requestedPath.startsWith("/themes/")
  );
}

function hasUpstreamApiConfig() {
  return Boolean(normalizeBaseUrl(process.env.OPENAI_API_BASE_URL || "") && process.env.OPENAI_API_KEY);
}

function normalizeBaseUrl(value) {
  const baseUrl = String(value || "").trim().replace(/\/+$/, "");
  if (!baseUrl) return "";
  return baseUrl.endsWith("/v1") ? baseUrl : `${baseUrl}/v1`;
}

function normalizeUrl(value) {
  return String(value || "").trim().replace(/\/+$/, "");
}

async function readJsonBody(req) {
  const body = await readRequestBody(req);
  if (!body.length) return {};
  try {
    return JSON.parse(body.toString("utf8"));
  } catch {
    const error = new Error("Request body must be valid JSON");
    error.statusCode = 400;
    throw error;
  }
}

function readRequestBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > BODY_LIMIT_BYTES) {
        reject(new Error("Request body is too large"));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

async function writeDotEnvUpdates(filePath, updates) {
  const existing = await fsp.readFile(filePath, "utf8").catch((error) => {
    if (error.code === "ENOENT") return "";
    throw error;
  });
  const lines = existing ? existing.split(/\r?\n/) : [];
  const seen = new Set();
  const nextLines = lines.map((line) => {
    const parsed = parseEnvLine(line);
    if (!parsed || !Object.hasOwn(updates, parsed.key)) return line;
    seen.add(parsed.key);
    return `${parsed.key}=${formatEnvValue(updates[parsed.key])}`;
  });

  Object.entries(updates).forEach(([key, value]) => {
    process.env[key] = value;
    if (!seen.has(key)) nextLines.push(`${key}=${formatEnvValue(value)}`);
  });

  await fsp.writeFile(filePath, `${nextLines.join("\n").replace(/\n+$/g, "")}\n`, {
    mode: 0o600,
  });
}

function parseEnvLine(line) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) return null;
  const separator = trimmed.indexOf("=");
  if (separator === -1) return null;
  const key = trimmed.slice(0, separator).trim();
  return key ? { key } : null;
}

function formatEnvValue(value) {
  const text = String(value || "");
  if (!text || /^[A-Za-z0-9_:/@.+,=-]+$/.test(text)) return text;
  return JSON.stringify(text);
}

function sendJson(res, status, data) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  res.end(JSON.stringify(data));
}

function sendText(res, status, text) {
  res.writeHead(status, {
    "Content-Type": "text/plain; charset=utf-8",
    "Cache-Control": "no-store",
  });
  res.end(text);
}

function loadDotEnv(filePath) {
  if (!fs.existsSync(filePath)) return;
  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);
  lines.forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) return;
    const separator = trimmed.indexOf("=");
    if (separator === -1) return;
    const key = trimmed.slice(0, separator).trim();
    let value = trimmed.slice(separator + 1).trim();
    if (!key || process.env[key] !== undefined) return;
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  });
}
