#!/usr/bin/env node
/**
 * rag-core MCP server — 5 tools.
 * Cross-domain meta, health, search, and chat. The default entry point.
 */

const { get, post, del, asToolResult } = require('../../lib/api-client');
const { start } = require('../../lib/server-framework');

const tools = {
  rag_meta: {
    description:
      "Return the Swiss RAG capability manifest: collections, domains, sizes, available operation IDs. " +
      "Call this FIRST in any new session before choosing a domain tool. " +
      "Returns a JSON manifest with collection counts (e.g. fedlex=544k, curia_vista=64k, science=92k) and tool routing hints.",
    parameters: { type: 'object', properties: {}, additionalProperties: false },
    handler: async () => asToolResult(await get('/v1/meta')),
  },

  rag_health: {
    description:
      "Report Swiss RAG backend health: Qdrant, Redis, reranker, sparse-vector microservice, embedding factory. " +
      "Use before starting a long pipeline (e.g. multi-step research brief) to fail fast if a dependency is down. " +
      "Returns {status: 'up'|'degraded'|'down', dependencies: {...}}.",
    parameters: { type: 'object', properties: {}, additionalProperties: false },
    handler: async () => asToolResult(await get('/v1/system/health')),
  },

  search_all: {
    description:
      "Cross-collection hybrid search across Swiss federal law, parliament, votes, science, statistics, and documents. " +
      "Use when the question's domain is ambiguous, OR when you need a broad first pass. " +
      "For domain-specific deep-dives prefer law_search_articles / parliament_search / votes_search / science_search / stat_discover_datasets — they return richer payloads. " +
      "Confidence < 0.6 means no good match; suggest the user broadens or rephrases.",
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Natural-language query in DE / FR / IT / EN' },
        top_k: { type: 'integer', default: 10, minimum: 1, maximum: 50 },
        collections: {
          type: 'array',
          items: { type: 'string' },
          description: "Optional subset, e.g. ['fedlex','curia_vista_business']. Omit to search all.",
        },
        language: { type: 'string', enum: ['de', 'fr', 'it', 'en'], description: 'Preferred response language' },
      },
      required: ['query'],
      additionalProperties: false,
    },
    handler: async (args) => asToolResult(await post('/v1/search', args)),
  },

  chat_ask: {
    description:
      "One-shot conversational RAG: creates a session, sends one message, returns answer + cited sources. " +
      "Use for synthesis questions ('Summarise Swiss climate policy across law and motions'). " +
      "For domain-precise lookups (an SR number, a vote number) use the corresponding *_get_* tool — chat_ask is slower (~5-6s LLM synthesis). " +
      "Returns {session_id, answer, sources[], confidence}.",
    parameters: {
      type: 'object',
      properties: {
        message: { type: 'string', description: 'User question' },
        max_chunks: { type: 'integer', default: 5, minimum: 1, maximum: 20 },
        collections: { type: 'array', items: { type: 'string' } },
        language: { type: 'string', enum: ['de', 'fr', 'it', 'en'] },
      },
      required: ['message'],
      additionalProperties: false,
    },
    handler: async (args) => {
      // 1. create session
      const sessionRes = await post('/v1/chat/sessions', { user_id: 'mcp-chat-ask' });
      if (sessionRes.status >= 400) return asToolResult(sessionRes);
      const sessionId = sessionRes.body.session_id;
      // 2. immediate message
      const msgRes = await post(`/v1/chat/sessions/${sessionId}/messages`, {
        message: args.message,
        max_chunks: args.max_chunks || 5,
        collections: args.collections,
        language: args.language,
      });
      const out = asToolResult(msgRes);
      if (out && typeof out === 'object' && !out.error) out.session_id = sessionId;
      return out;
    },
  },

  chat_session_create: {
    description:
      "Explicitly create a chat session and return its session_id. " +
      "Use only when you need to retain the session across multiple tool calls (e.g. streaming, multi-turn dialogue). " +
      "For one-shot queries use chat_ask instead.",
    parameters: {
      type: 'object',
      properties: {
        user_id: { type: 'string', description: 'Optional user identifier' },
        metadata: { type: 'object', description: 'Free-form session metadata' },
      },
      additionalProperties: false,
    },
    handler: async (args) => asToolResult(await post('/v1/chat/sessions', args)),
  },

  // ---------- Tier 3 (deferred) ----------

  chat_session_get: {
    defer_loading: true,
    description: "Tier-3 admin. Fetch a chat session with message history. Use when you need to inspect or resume a prior session.",
    parameters: { type: 'object', properties: { session_id: { type: 'string' } }, required: ['session_id'], additionalProperties: false },
    handler: async (args) => asToolResult(await get(`/v1/chat/sessions/${encodeURIComponent(args.session_id)}`)),
  },

  chat_session_delete: {
    defer_loading: true,
    description: "Tier-3 admin. Delete a chat session. Irreversible.",
    parameters: { type: 'object', properties: { session_id: { type: 'string' } }, required: ['session_id'], additionalProperties: false },
    handler: async (args) => asToolResult(await del(`/v1/chat/sessions/${encodeURIComponent(args.session_id)}`)),
  },

  chat_session_stream: {
    defer_loading: true,
    description: "Tier-3 admin. Send a chat message in streaming (SSE) mode. The MCP transport buffers the stream and returns the final assembled answer. Use chat_ask for non-streaming.",
    parameters: {
      type: 'object',
      properties: {
        session_id: { type: 'string' },
        message: { type: 'string' },
        max_chunks: { type: 'integer', default: 5 },
      },
      required: ['session_id', 'message'],
      additionalProperties: false,
    },
    handler: async (args) => asToolResult(await post(`/v1/chat/sessions/${encodeURIComponent(args.session_id)}/messages/stream`, {
      message: args.message, max_chunks: args.max_chunks || 5,
    })),
  },

  admin_list_collections: {
    defer_loading: true,
    description: "Tier-3 admin. List Qdrant collections with point counts and health. Useful for diagnostics, not for end-user queries.",
    parameters: { type: 'object', properties: {}, additionalProperties: false },
    handler: async () => asToolResult(await get('/v1/admin/collections')),
  },

  admin_clear_cache: {
    defer_loading: true,
    description: "Tier-3 admin. Clear the Redis semantic / embedding cache. Use only when testing a change to embedding or reranker behaviour.",
    parameters: {
      type: 'object',
      properties: { scope: { type: 'string', enum: ['semantic', 'embedding', 'all'], default: 'all' } },
      additionalProperties: false,
    },
    handler: async (args) => asToolResult(await post('/v1/admin/cache/clear', args)),
  },

  admin_embed_probe: {
    defer_loading: true,
    description: "Tier-3 admin. Generate an embedding for a test string and return the vector (truncated) + latency. Use to diagnose Provider Factory / BGE-M3 health.",
    parameters: {
      type: 'object',
      properties: { text: { type: 'string' } },
      required: ['text'],
      additionalProperties: false,
    },
    handler: async (args) => asToolResult(await post('/v1/admin/embed', args)),
  },
};

start({ name: 'rag-core', version: '2.0.0', tools });
