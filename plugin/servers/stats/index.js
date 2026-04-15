#!/usr/bin/env node
/**
 * rag-stats MCP server — 6 tools.
 * Swiss / international statistics: Eurostat, OECD, BFS PxWeb, BFS LSE, BFS SAKE.
 * Two-tier system: semantic discovery (Qdrant) + SQL analytics (DuckDB on Parquet).
 */

const { get, post, asToolResult } = require('../../lib/api-client');
const { start } = require('../../lib/server-framework');

const tools = {
  stat_discover_datasets: {
    description:
      "Schema-aware dataset discovery across 6 statistical sources (Eurostat 7k, OECD 1.4k, StatsWiss 152, PxWeb 367, BFS LSE 166, BFS SAKE 4). " +
      "Returns datasets with schema_mapping (year_col, value_col, sex_col, geo_col, ...), topic_tags, metric_type, and ready-to-use SQL templates. " +
      "Use FIRST to find which dataset answers a quantitative question, THEN call stat_run_sql to compute the actual numbers.",
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string' },
        top_k: { type: 'integer', default: 10, minimum: 1, maximum: 50 },
        topic_tags: { type: 'array', items: { type: 'string' }, description: 'e.g. ["wages","unemployment"]' },
        metric_type: { type: 'string', enum: ['rate', 'percentage', 'gap', 'absolute', 'currency', 'hours', 'index', 'ratio', 'count'] },
        has_sex: { type: 'boolean' },
        has_ch_data: { type: 'boolean' },
      },
      required: ['query'],
      additionalProperties: false,
    },
    handler: async (args) => asToolResult(await post('/v1/search/datasets', args)),
  },

  stat_list_tables: {
    description:
      "List available statistical Parquet tables (PxWeb, LSE, SAKE) with row-count and last-modified. " +
      "Use to browse what's queryable. For semantic discovery (which dataset for X?) use stat_discover_datasets.",
    parameters: {
      type: 'object',
      properties: {
        source: { type: 'string', description: 'Filter by source (pxweb, bfs_lse, bfs_sake, eurostat, oecd)' },
        limit: { type: 'integer', default: 100, minimum: 1, maximum: 1000 },
      },
      additionalProperties: false,
    },
    handler: async (args) => asToolResult(await get('/v1/statistics/tables', { query: args })),
  },

  stat_get_schema: {
    description:
      "Fetch column schema for one statistical table (column names, types, value ranges, dimension members). " +
      "Use after stat_list_tables / stat_discover_datasets to understand the table before writing SQL.",
    parameters: {
      type: 'object',
      properties: {
        table_id: { type: 'string', description: 'e.g. "px-x-0304010000_203"' },
      },
      required: ['table_id'],
      additionalProperties: false,
    },
    handler: async (args) => asToolResult(await get(`/v1/statistics/tables/${encodeURIComponent(args.table_id)}`)),
  },

  stat_run_sql: {
    description:
      "Run a read-only DuckDB SELECT against statistical Parquet files (read_parquet('/data/...')) and the DWH (dim_canton, dim_region, dim_geography, fact_statistics, schema_links). " +
      "DML/DDL is blocked. Always pair with stat_get_schema first to know the columns. " +
      "Example: SELECT geschlecht, AVG(wert) FROM read_parquet('/data/pxweb/lohn/px-x-0304010000_203.parquet') WHERE Jahr='2022' GROUP BY geschlecht.",
    parameters: {
      type: 'object',
      properties: {
        sql: { type: 'string' },
        limit: { type: 'integer', default: 1000, minimum: 1, maximum: 100000 },
      },
      required: ['sql'],
      additionalProperties: false,
    },
    handler: async (args) => asToolResult(await post('/v1/statistics/query', args)),
  },

  stat_list_topics: {
    description:
      "List the topic-tag vocabulary used to classify statistical datasets, aggregated across the 6 stat collections " +
      "(eurostat, oecd, statswiss, pxweb_tables, bfs_lse, bfs_sake). " +
      "Returns {total_topics, topics: [{tag, count, by_collection}]} sorted by total count descending.",
    parameters: {
      type: 'object',
      properties: {
        min_count: { type: 'integer', default: 1, minimum: 1, description: 'Only include topics with at least this total count' },
      },
      additionalProperties: false,
    },
    handler: async (args) => asToolResult(await get('/v1/statistics/topics', { query: args || {} })),
  },

  stat_cross_query: {
    description:
      "Find datasets across different sources (Eurostat, OECD, BFS) that measure the SAME metric or are COMPARABLE / COMPLEMENTARY. " +
      "Backed by the schema_links DuckDB table (142 LLM-verified cross-source relations: 60 SAME_METRIC, 47 COMPARABLE, 35 COMPLEMENTS). " +
      "table_id is matched with LIKE against source_path and target_path (use a path fragment or dataset ID).",
    parameters: {
      type: 'object',
      properties: {
        table_id: { type: 'string', description: 'Dataset ID or path fragment, e.g. "lohn" or "px-x-0304010000_203"' },
        relation_type: { type: 'string', enum: ['SAME_METRIC', 'COMPARABLE', 'COMPLEMENTS'] },
        limit: { type: 'integer', default: 50, minimum: 1, maximum: 200 },
      },
      required: ['table_id'],
      additionalProperties: false,
    },
    handler: async (args) => asToolResult(await post('/v1/statistics/cross-query', args)),
  },
};

start({ name: 'rag-stats', version: '2.0.0', tools });
