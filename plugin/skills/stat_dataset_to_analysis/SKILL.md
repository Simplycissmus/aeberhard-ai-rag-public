---
name: stat_dataset_to_analysis
description: Find the right Swiss statistical dataset and compute an actual number from it. Triggers on quantitative asks ("wie viele", "Lohn", "Erwerbsquote", "Gender Pay Gap", "Bevölkerung Kanton").
tools:
  - stat_discover_datasets
  - stat_list_tables
  - stat_get_schema
  - stat_run_sql
---

# Statistical Dataset to Analysis

Two-tier workflow: discover the right dataset (semantic) → compute the answer (SQL).

## Workflow

1. `stat_discover_datasets { query, top_k: 5 }` — find candidate datasets across Eurostat / OECD / BFS / PxWeb / LSE / SAKE. Each hit includes `schema_mapping` + `sql_template`.
2. Pick the dataset with highest confidence AND matching `has_ch_data` / `has_sex` / `metric_type` for the question.
3. `stat_get_schema { table_id }` — fetch column list, types, and value ranges (year range, canton codes, ISCO/NOGA codes).
4. Adapt the returned `sql_template` to the specific question.
5. `stat_run_sql { sql, limit }` — execute; result is a row array.
6. Report the answer with:
   - The computed number
   - The dataset ID and source (Eurostat / BFS / ...)
   - The exact SQL used (for reproducibility)

## Constraints

- Parquet paths live under `/data/<source>/...`; use `read_parquet('<path>')`. The DWH is accessible as regular table names (dim_canton, dim_region, dim_geography, fact_statistics, schema_links).
- Never SELECT * on large Parquets without a LIMIT or WHERE.
- If the dataset year range does not cover the user's requested year, say so — don't extrapolate.
- For cross-source comparisons use `schema_links` table via `stat_run_sql` (stat_cross_query is not yet wired in v7).
