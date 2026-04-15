#!/usr/bin/env node
/**
 * rag-law-core MCP server — 5 tools.
 * Swiss federal law (Fedlex, 544k articles, 5,099 laws) + Federal Court (BGer, 345k decisions).
 */

const { get, post, asToolResult } = require('../../lib/api-client');
const { start } = require('../../lib/server-framework');

const tools = {
  law_search_articles: {
    description:
      "Search Swiss federal law articles (Fedlex — 544k articles from 5,099 laws). " +
      "Returns ranked article snippets with SR number, article ID, and DE/FR/IT text excerpts. " +
      "Use for statutes and legal definitions. Use law_search_decisions for court rulings. " +
      "Confidence < 0.6 → no good match; suggest a broader query. Hybrid Dense+BM25 with reranker.",
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string' },
        top_k: { type: 'integer', default: 10, minimum: 1, maximum: 50 },
        sr_number: { type: 'string', description: 'Filter to a single law (e.g. "210" for ZGB)' },
        domain: { type: 'string', description: 'Legal domain filter (see law_get_law for the list)' },
        language: { type: 'string', enum: ['de', 'fr', 'it'] },
      },
      required: ['query'],
      additionalProperties: false,
    },
    handler: async (args) => asToolResult(await post('/v1/law/articles/search', args)),
  },

  law_get_law: {
    description:
      "Fetch a single Swiss federal law by SR number, with all articles paginated. " +
      "Use after law_search_articles when you need full surrounding context. " +
      "Example: {sr_number: '210'} returns the Zivilgesetzbuch. " +
      "Returns {sr_number, title, articles[], summary, domain}.",
    parameters: {
      type: 'object',
      properties: {
        sr_number: { type: 'string', description: 'Systematic Collection number, e.g. "210"' },
        page: { type: 'integer', default: 1 },
        page_size: { type: 'integer', default: 50 },
      },
      required: ['sr_number'],
      additionalProperties: false,
    },
    handler: async (args) => asToolResult(await get(`/v1/law/laws/${encodeURIComponent(args.sr_number)}`, {
      query: { page: args.page, page_size: args.page_size },
    })),
  },

  law_search_decisions: {
    description:
      "Search Swiss Federal Court (BGer) decisions — 345k rulings since 1954. " +
      "Returns ranked decision snippets with case ID, date, regeste, and text excerpts. " +
      "Use for case law / jurisprudence. Use law_search_articles for statutes. " +
      "Filter by year, language, or chamber for narrower results.",
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string' },
        top_k: { type: 'integer', default: 10, minimum: 1, maximum: 50 },
        year_from: { type: 'integer' },
        year_to: { type: 'integer' },
        language: { type: 'string', enum: ['de', 'fr', 'it'] },
        chamber: { type: 'string', description: 'BGer chamber filter (e.g. "II")' },
      },
      required: ['query'],
      additionalProperties: false,
    },
    handler: async (args) => asToolResult(await post('/v1/law/decisions/search', args)),
  },

  law_get_decision: {
    description:
      "Fetch a single BGer decision by ID, with full text and metadata. " +
      "Use after law_search_decisions when you need the full ruling text. " +
      "Returns {id, date, regeste, considerations, dispositif, references}.",
    parameters: {
      type: 'object',
      properties: {
        decision_id: { type: 'string', description: 'BGer decision identifier' },
      },
      required: ['decision_id'],
      additionalProperties: false,
    },
    handler: async (args) => asToolResult(await get(`/v1/law/decisions/${encodeURIComponent(args.decision_id)}`)),
  },

  law_get_references: {
    description:
      "Fetch the cross-reference chain for a Fedlex article: outgoing citations (laws this article cites) " +
      "and incoming references (articles in the same law that cite it). " +
      "Article IDs may be passed with or without the 'art_' prefix (e.g. '3' or 'art_3'). " +
      "Returns {source_sr, source_article, source_law, outgoing[], incoming[]}.",
    parameters: {
      type: 'object',
      properties: {
        sr_number: { type: 'string', description: 'SR number of the law, e.g. "220" for OR' },
        article_id: { type: 'string', description: 'Article identifier, e.g. "3" or "art_3"' },
      },
      required: ['sr_number', 'article_id'],
      additionalProperties: false,
    },
    handler: async (args) => asToolResult(await get(
      `/v1/law/references/${encodeURIComponent(args.sr_number)}/${encodeURIComponent(args.article_id)}`
    )),
  },
};

start({ name: 'rag-law-core', version: '2.0.0', tools });
