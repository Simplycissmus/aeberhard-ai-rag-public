#!/usr/bin/env node
/**
 * rag-votes MCP server — 3 tools.
 * Swiss federal popular votes (Swissvotes — 708 votes since 1848).
 */

const { get, post, asToolResult } = require('../../lib/api-client');
const { start } = require('../../lib/server-framework');

const tools = {
  votes_search: {
    description:
      "Search Swiss federal popular votes (Swissvotes — 708 votes since 1848: initiatives, referendums, counter-proposals). " +
      "Returns ranked votes with anr (vote number), date, title, type, result (accepted/rejected), and yes-share by canton. " +
      "Hybrid Dense+BM25 + reranker. Use votes_get_vote for full detail; votes_timeline for date-range listings.",
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string' },
        top_k: { type: 'integer', default: 10, minimum: 1, maximum: 50 },
        year_from: { type: 'integer' },
        year_to: { type: 'integer' },
        result: { type: 'string', enum: ['accepted', 'rejected'], description: 'Filter by outcome' },
        domain: { type: 'string', description: 'Policy domain (see /v1/votes/domains)' },
      },
      required: ['query'],
      additionalProperties: false,
    },
    handler: async (args) => asToolResult(await post('/v1/votes/search', args)),
  },

  votes_get_vote: {
    description:
      "Fetch a single Swissvotes vote by its anr (vote number). " +
      "Returns full metadata: date, title (DE/FR/IT), type, federal yes/no shares, canton-level results, related Curia Vista businesses, voting recommendations by party. " +
      "Use after votes_search to drill into one vote.",
    parameters: {
      type: 'object',
      properties: {
        anr: { type: 'string', description: 'Swissvotes anr (e.g. "676")' },
      },
      required: ['anr'],
      additionalProperties: false,
    },
    handler: async (args) => asToolResult(await get(`/v1/votes/${encodeURIComponent(args.anr)}`)),
  },

  votes_timeline: {
    description:
      "List Swiss federal popular votes by date range. Use for chronological browsing or to count votes per period. " +
      "Returns {votes: [{anr, date, title, type, result}], total}. Sorted descending by date. " +
      "For substantive search use votes_search instead.",
    parameters: {
      type: 'object',
      properties: {
        year_from: { type: 'integer' },
        year_to: { type: 'integer' },
        domain: { type: 'string' },
        limit: { type: 'integer', default: 50, minimum: 1, maximum: 500 },
      },
      additionalProperties: false,
    },
    handler: async (args) => asToolResult(await get('/v1/votes/timeline', { query: args })),
  },
};

start({ name: 'rag-votes', version: '2.0.0', tools });
