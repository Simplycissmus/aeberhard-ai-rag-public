#!/usr/bin/env node
/**
 * rag-science MCP server — 6 tools (search, topics, sql, research_submit,
 * research_coverage, research_poll).
 * 92k research papers (OpenAlex + arXiv), Swiss-relevant policy science.
 */

const { get, post, asToolResult } = require('../../lib/api-client');
const { start } = require('../../lib/server-framework');

const tools = {
  science_search: {
    description:
      "Search 92k research papers (OpenAlex + arXiv, Swiss-policy-relevant). " +
      "Returns ranked papers with DOI, title, authors, year, abstract, venue, OA URL, EBG-aligned topic tags. " +
      "Hybrid Dense+BM25 + reranker. Use science_run_sql for citation-graph analytics.",
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string' },
        top_k: { type: 'integer', default: 10, minimum: 1, maximum: 50 },
        year_from: { type: 'integer' },
        year_to: { type: 'integer' },
        topic: { type: 'string', description: 'EBG-aligned topic (see science_list_topics)' },
        oa_only: { type: 'boolean', default: false, description: 'Filter to open-access papers' },
      },
      required: ['query'],
      additionalProperties: false,
    },
    handler: async (args) => asToolResult(await post('/v1/science/search', args)),
  },

  science_list_topics: {
    description:
      "List the EBG-aligned topic taxonomy used to classify the 92k papers (with paper counts per topic). " +
      "Use to discover what topics the corpus covers before searching, OR to filter science_search by topic.",
    parameters: { type: 'object', properties: {}, additionalProperties: false },
    handler: async () => asToolResult(await get('/v1/science/topics')),
  },

  science_run_sql: {
    description:
      "Run a read-only DuckDB SELECT against the science DB (~92k papers + citation edges + topics + authors). " +
      "Tables: papers (id, doi, title, year, abstract, venue, ...), topics (id, label), paper_topics, authors, paper_authors, citations (src, dst). " +
      "Use for citation graphs, co-author analysis, topic trends. DML/DDL blocked.",
    parameters: {
      type: 'object',
      properties: {
        sql: { type: 'string' },
        limit: { type: 'integer', default: 500, minimum: 1, maximum: 50000 },
      },
      required: ['sql'],
      additionalProperties: false,
    },
    handler: async (args) => asToolResult(await post('/v1/science/sql', args)),
  },

  science_research_submit: {
    description:
      "Submit a background deep-research job: fetch PDFs/HTML of OA papers, run Marker OCR + vision-LM, " +
      "embed fulltext chunks into science_v2. Returns immediately with a job_id. " +
      "Backend auto-selects .46 GPU (fast) or CT-115 (fallback, auto-start/stop). " +
      "Three modes: 'paper' (single DOI), 'cluster' (topic batch), 'smart_batch' (auto-pick by citation count). " +
      "Poll progress via science_research_poll. Use science_research_coverage first to see what's worth enriching.",
    parameters: {
      type: 'object',
      properties: {
        mode: { type: 'string', enum: ['paper', 'cluster', 'smart_batch'], description: 'Job type' },
        doi: { type: 'string', description: "DOI (required when mode='paper')" },
        topic_subfield: { type: 'string', description: "Subfield name (used when mode='cluster')" },
        topic_field: { type: 'string', description: "Broad field name (used when mode='cluster'/'smart_batch')" },
        year_min: { type: 'integer', description: 'Only enrich papers from this year onwards' },
        cited_min: { type: 'integer', minimum: 0, default: 10, description: 'Minimum cited_by_count to qualify' },
        limit: { type: 'integer', minimum: 1, maximum: 100, default: 20, description: 'Papers processed per job run' },
      },
      required: ['mode'],
      additionalProperties: false,
    },
    handler: async (args) => asToolResult(await post('/v1/science/research/jobs', args)),
  },

  science_research_coverage: {
    description:
      "Gap analysis: which papers have deep-fulltext indexing and which are pending. " +
      "Returns per-topic_field counts (total OA / researched / pending) plus top candidates for the next smart_batch job. " +
      "Read-only — no work triggered. Call this before science_research_submit to pick where the next enrichment pays off.",
    parameters: { type: 'object', properties: {}, additionalProperties: false },
    handler: async () => asToolResult(await get('/v1/science/research/status')),
  },

  science_research_poll: {
    description:
      "Poll progress of a running or completed research job by job_id. " +
      "Returns: mode, backend chosen, progress counters, ETA, per-paper success/failure, final logs. " +
      "Returns 404 if job_id unknown or expired (24h retention after completion).",
    parameters: {
      type: 'object',
      properties: {
        job_id: { type: 'string', description: 'Job handle returned by science_research_submit, e.g. rj_a1b2c3d4' },
      },
      required: ['job_id'],
      additionalProperties: false,
    },
    handler: async (args) => asToolResult(await get(`/v1/science/research/jobs/${encodeURIComponent(args.job_id)}`)),
  },
};

start({ name: 'rag-science', version: '2.0.0', tools });
