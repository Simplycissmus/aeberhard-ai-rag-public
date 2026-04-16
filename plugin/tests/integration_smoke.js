#!/usr/bin/env node
/**
 * Integration smoke test: hit the live backend (rag-backend.internal/v1) via a few
 * representative tool handlers. Does NOT spawn MCP servers — imports handlers directly.
 *
 * Run: RAG_API_URL=https://rag.aeberhard.ai/v1 node tests/integration_smoke.js
 */

process.env.RAG_API_URL = process.env.RAG_API_URL || 'https://rag.aeberhard.ai/v1';

const { get, post, del, asToolResult } = require('../lib/api-client');

async function run(name, fn) {
  try {
    const r = await fn();
    const isErr = r && r.error;
    console.log(`${isErr ? 'WARN' : 'OK  '}  ${name}: ${JSON.stringify(r).slice(0, 160)}`);
    return !isErr;
  } catch (e) {
    console.log(`FAIL  ${name}: ${e.message}`);
    return false;
  }
}

(async () => {
  let passed = 0, total = 0;
  for (const [name, fn] of [
    ['GET /v1/meta',           async () => asToolResult(await get('/v1/meta'))],
    ['GET /v1/system/health',  async () => asToolResult(await get('/v1/system/health'))],
    ['POST /v1/search',        async () => asToolResult(await post('/v1/search', { query: 'Arbeitslosigkeit', top_k: 3 }))],
    ['POST /v1/law/articles/search', async () => asToolResult(await post('/v1/law/articles/search', { query: 'Eigentum', top_k: 3 }))],
    ['POST /v1/parliament/search',   async () => asToolResult(await post('/v1/parliament/search', { query: 'Klima', top_k: 3 }))],
    ['POST /v1/votes/search',        async () => asToolResult(await post('/v1/votes/search', { query: 'AHV', top_k: 3 }))],
    ['POST /v1/science/search',      async () => asToolResult(await post('/v1/science/search', { query: 'climate policy', top_k: 3 }))],
    ['GET /v1/science/topics',       async () => asToolResult(await get('/v1/science/topics'))],
    ['GET /v1/statistics/tables',    async () => asToolResult(await get('/v1/statistics/tables', { query: { limit: 5 } }))],
    // chat_session_delete regression case (CT-110 §2.1 — del was missing in core/index.js import).
    // Create a session, immediately delete it, both via tools that core/index.js relies on.
    ['chat_session_delete (regression — CT-110 §2.1)', async () => {
      const s = await post('/v1/chat/sessions', { user_id: 'smoke-del' });
      const sid = s && s.body && s.body.session_id;
      if (!sid) return { error: { message: `no session_id from create — got ${JSON.stringify(s).slice(0,150)}` } };
      return asToolResult(await del(`/v1/chat/sessions/${encodeURIComponent(sid)}`));
    }],
  ]) {
    total++;
    if (await run(name, fn)) passed++;
  }
  console.log(`\n${passed}/${total} integration checks returned non-error`);
  process.exit(passed === total ? 0 : 1);
})();
