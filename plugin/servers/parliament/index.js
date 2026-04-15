#!/usr/bin/env node
/**
 * rag-parliament MCP server — 6 tools.
 * Swiss parliamentary business (Curia Vista — 64,853 items, all enriched).
 */

const { get, post, asToolResult } = require('../../lib/api-client');
const { start } = require('../../lib/server-framework');

const tools = {
  parliament_search: {
    description:
      "Search Swiss parliamentary business items (Curia Vista — 64k motions, postulates, interpellations, parliamentary initiatives). " +
      "Returns ranked items with business number, type, author, year, status, and snippet. " +
      "Filter by year, business_type, author, department, or domain. " +
      "Use recency_boost (0.0-1.0, default 0.3) to bias toward recent items. Hybrid Dense+BM25 + reranker.",
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string' },
        top_k: { type: 'integer', default: 10, minimum: 1, maximum: 50 },
        business_type: { type: 'string', description: 'e.g. "Motion", "Postulat", "Interpellation"' },
        year_from: { type: 'integer' },
        year_to: { type: 'integer' },
        department: { type: 'string' },
        domain: { type: 'string' },
        author: { type: 'string', description: 'Surname of submitting parliamentarian' },
        recency_boost: { type: 'number', default: 0.3, minimum: 0, maximum: 1 },
      },
      required: ['query'],
      additionalProperties: false,
    },
    handler: async (args) => asToolResult(await post('/v1/parliament/search', args)),
  },

  parliament_get_business: {
    description:
      "Fetch a single Curia Vista business item by its number. " +
      "Returns full metadata: title, author, cosigners (if loaded), abstract, status, vote results, related laws. " +
      "Use after parliament_search to drill into one item.",
    parameters: {
      type: 'object',
      properties: {
        business_number: { type: 'string', description: 'e.g. "23.4567"' },
      },
      required: ['business_number'],
      additionalProperties: false,
    },
    handler: async (args) => asToolResult(await get(`/v1/parliament/business/${encodeURIComponent(args.business_number)}`)),
  },

  parliament_run_sql: {
    description:
      "Run a read-only DuckDB SELECT against the curia_vista table (35 columns, 64k rows). " +
      "Use for analytics: counts by year/type/department, author rankings, topic trends. " +
      "DML/DDL is blocked. Schema includes business_number, type, year, author, cosigners (json), department, domain, abstract, status, vote_result, br_recommendation, llm_keywords[], llm_domain.",
    parameters: {
      type: 'object',
      properties: {
        sql: { type: 'string', description: 'Single SELECT statement against the curia_vista table' },
        limit: { type: 'integer', default: 100, minimum: 1, maximum: 10000 },
      },
      required: ['sql'],
      additionalProperties: false,
    },
    handler: async (args) => asToolResult(await post('/v1/parliament/sql', args)),
  },

  parliament_get_debate: {
    description:
      "Fetch National Council / Council of States debate transcripts for a business item, on-demand from the live Swiss Parliament API. " +
      "Returns {business_number, total_speeches, speeches[{speaker, function, party, canton, council, date, text, language}]}. " +
      "May return zero speeches if no vote sessions occurred yet.",
    parameters: {
      type: 'object',
      properties: {
        business_number: { type: 'string', description: 'e.g. "24.3516"' },
        language: { type: 'string', enum: ['DE', 'FR', 'IT'], default: 'DE' },
      },
      required: ['business_number'],
      additionalProperties: false,
    },
    handler: async (args) => asToolResult(await post('/v1/parliament/debate', args)),
  },

  parliament_get_cosigners: {
    description:
      "Fetch authors, cosigners, speakers, and opponents for a parliamentary business item, on-demand from the live Parliament API. " +
      "Returns {business_number, authors[], cosigners[], speakers[], opponents[]} with best-effort name/party/canton resolution.",
    parameters: {
      type: 'object',
      properties: { business_number: { type: 'string' } },
      required: ['business_number'],
      additionalProperties: false,
    },
    handler: async (args) => asToolResult(await post('/v1/parliament/cosigners', args)),
  },

  parliament_get_timeline: {
    description:
      "Fetch the chronological lifecycle events for a parliamentary business item (council resolutions, committee preconsultations), " +
      "on-demand from the live Parliament API. Returns {business_number, total_events, timeline[{date, council, decision, committee}]} " +
      "sorted by date ascending.",
    parameters: {
      type: 'object',
      properties: { business_number: { type: 'string' } },
      required: ['business_number'],
      additionalProperties: false,
    },
    handler: async (args) => asToolResult(await post('/v1/parliament/timeline', args)),
  },
};

start({ name: 'rag-parliament', version: '2.0.0', tools });
