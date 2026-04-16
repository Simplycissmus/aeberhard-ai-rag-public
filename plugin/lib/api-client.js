/**
 * Shared HTTP client for swiss-rag plugin (public variant).
 * - Single keep-alive agent per protocol per process
 * - X-Request-ID propagation
 * - 3x exponential backoff retry on 5xx / network errors
 * - Sends X-API-Key from RAG_API_KEY env var (required in public deployments)
 */

const http = require('http');
const https = require('https');
const crypto = require('crypto');

const DEFAULT_BASE_URL = process.env.RAG_API_URL || 'https://rag.aeberhard.ai/v1';
const API_KEY = process.env.RAG_API_KEY || '';
const DEFAULT_TIMEOUT_MS = parseInt(process.env.RAG_API_TIMEOUT_MS || '30000', 10);
const MAX_RETRIES = parseInt(process.env.RAG_API_RETRIES || '3', 10);

const httpAgent = new http.Agent({ keepAlive: true, maxSockets: 16 });
const httpsAgent = new https.Agent({ keepAlive: true, maxSockets: 16 });

function newRequestId() {
  return 'mcp-' + crypto.randomBytes(8).toString('hex');
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Low-level HTTP request with retries.
 * @param {string} method GET|POST|DELETE
 * @param {string} pathOrUrl Path beginning with `/v1/...` (joined to baseUrl) or full URL
 * @param {object} opts {body?, query?, headers?, baseUrl?, timeoutMs?, requestId?}
 * @returns {Promise<{status:number, headers:object, body:any, requestId:string}>}
 */
async function request(method, pathOrUrl, opts = {}) {
  const baseUrl = opts.baseUrl || DEFAULT_BASE_URL;
  const requestId = opts.requestId || newRequestId();
  const timeoutMs = opts.timeoutMs || DEFAULT_TIMEOUT_MS;

  let urlStr;
  if (/^https?:\/\//.test(pathOrUrl)) {
    urlStr = pathOrUrl;
  } else {
    // Strip leading /v1 if baseUrl already includes /v1
    const normalised = pathOrUrl.startsWith('/v1') && baseUrl.endsWith('/v1')
      ? pathOrUrl.slice(3)
      : pathOrUrl;
    urlStr = baseUrl.replace(/\/+$/, '') + (normalised.startsWith('/') ? normalised : '/' + normalised);
  }
  if (opts.query && Object.keys(opts.query).length) {
    const u = new URL(urlStr);
    for (const [k, v] of Object.entries(opts.query)) {
      if (v === undefined || v === null) continue;
      u.searchParams.set(k, String(v));
    }
    urlStr = u.toString();
  }

  // SSRF guard: pin to DEFAULT_BASE_URL host regardless of what the caller passed.
  // This prevents a compromised tool argument or prompt-injection from redirecting
  // the plugin to an attacker-controlled or internal host.
  try {
    const expectedHost = new URL(DEFAULT_BASE_URL).host;
    const actualHost = new URL(urlStr).host;
    if (actualHost !== expectedHost) {
      throw new Error(`host mismatch — plugin is pinned to ${expectedHost}`);
    }
  } catch (hostGuardErr) {
    throw hostGuardErr;
  }

  const url = new URL(urlStr);
  const isHttps = url.protocol === 'https:';
  const lib = isHttps ? https : http;
  const agent = isHttps ? httpsAgent : httpAgent;

  const bodyStr = opts.body ? JSON.stringify(opts.body) : null;
  const headers = {
    'Accept': 'application/json',
    'X-Request-ID': requestId,
    'User-Agent': 'swiss-rag-plugin-public/2.1.0',
    ...(API_KEY ? { 'X-API-Key': API_KEY } : {}),
    ...(bodyStr ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(bodyStr) } : {}),
    ...(opts.headers || {}),
  };

  const reqOpts = {
    method,
    hostname: url.hostname,
    port: url.port || (isHttps ? 443 : 80),
    path: url.pathname + url.search,
    headers,
    agent,
    timeout: timeoutMs,
  };

  let lastErr;
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const res = await new Promise((resolve, reject) => {
        const req = lib.request(reqOpts, (response) => {
          const chunks = [];
          response.on('data', c => chunks.push(c));
          response.on('end', () => {
            const raw = Buffer.concat(chunks).toString('utf8');
            let parsed = raw;
            const ct = response.headers['content-type'] || '';
            if (ct.includes('json') && raw) {
              try { parsed = JSON.parse(raw); } catch { /* keep raw */ }
            }
            resolve({ status: response.statusCode, headers: response.headers, body: parsed, requestId });
          });
        });
        req.on('error', reject);
        req.on('timeout', () => req.destroy(new Error(`timeout after ${timeoutMs}ms`)));
        if (bodyStr) req.write(bodyStr);
        req.end();
      });

      // Retry on 5xx
      if (res.status >= 500 && attempt < MAX_RETRIES - 1) {
        await sleep(200 * Math.pow(2, attempt));
        continue;
      }
      return res;
    } catch (err) {
      lastErr = err;
      if (attempt < MAX_RETRIES - 1) {
        await sleep(200 * Math.pow(2, attempt));
        continue;
      }
    }
  }
  throw lastErr || new Error('request failed');
}

/** Convenience wrappers. */
const get = (path, opts = {}) => request('GET', path, opts);
const post = (path, body, opts = {}) => request('POST', path, { ...opts, body });
const del = (path, opts = {}) => request('DELETE', path, opts);

/**
 * Format an HTTP response for return as MCP tool output.
 * On error, returns {error: {...}, request_id} so the agent sees a structured failure.
 */
function asToolResult(res) {
  if (res.status >= 400) {
    return {
      error: {
        status: res.status,
        request_id: res.requestId,
        detail: typeof res.body === 'object' ? res.body : { raw: String(res.body).slice(0, 800) },
      },
    };
  }
  return res.body;
}

/** Fixed 501 result for endpoints not yet present in v7 backend. */
function notImplemented(toolName, reason = 'Backend endpoint not yet exposed in /v1.') {
  return {
    error: {
      status: 501,
      tool: toolName,
      detail: reason,
      todo: 'See plugin/TODO_BACKEND_NEEDED.md',
    },
  };
}

module.exports = { request, get, post, del, asToolResult, notImplemented, newRequestId, DEFAULT_BASE_URL };
