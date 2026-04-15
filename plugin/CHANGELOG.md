# Changelog

## 2.1.0 — 2026-04-14

### Added
- 3 science research-job tools: `science_research_submit`, `science_research_poll`, `science_research_coverage`. Closes the last 501-stub from the 2.0.0 release.

### Changed
- Backend URL default: `http://10.0.0.111:8000/v1` (was `:8001` during v7 test phase, which is now merged to prod).
- Tool count: 29 → 31 (the single `science_research_job` stub was replaced by 3 concrete tools; +3 added, −1 stub removed, net +2; handler total 35 → 37 including 6 Tier-3 deferred).

### Fixed
- Plugin now works out-of-the-box against the production API (previous 2.0.0 default `:8001` returned ECONNREFUSED post-merge).

## 2.0.0 — 2026-04-13

Initial release of the aeberhard-ai-rag Claude Code plugin (v2).

### Added

- Plugin manifest (`.claude-plugin/plugin.json`) declaring 6 MCP servers.
- Shared HTTP client (`lib/api-client.js`): keep-alive pooling, X-Request-ID propagation, 3x exponential-backoff retry.
- Shared MCP server framework (`lib/server-framework.js`): stdio JSON-RPC, protocol 2025-06-18, no SDK dependency.
- `rag-core` server: 5 user tools (`rag_meta`, `rag_health`, `search_all`, `chat_ask`, `chat_session_create`) + 6 Tier-3 deferred tools (`chat_session_get/delete/stream`, `admin_list_collections`, `admin_clear_cache`, `admin_embed_probe`).
- `rag-law-core` server: 5 Fedlex + BGer tools (`law_search_articles`, `law_get_law`, `law_search_decisions`, `law_get_decision`, `law_get_references`).
- `rag-parliament` server: 6 Curia Vista tools (`parliament_search`, `parliament_get_business`, `parliament_run_sql`, `parliament_get_debate/cosigners/timeline`).
- `rag-votes` server: 3 Swissvotes tools (`votes_search`, `votes_get_vote`, `votes_timeline`).
- `rag-stats` server: 6 statistics tools (`stat_discover_datasets`, `stat_list_tables`, `stat_get_schema`, `stat_run_sql`, `stat_list_topics`, `stat_cross_query`).
- `rag-science` server: 4 science tools (`science_search`, `science_list_topics`, `science_run_sql`, `science_research_job`).
- 6 SKILL.md playbooks under `skills/`.
- Smoke tests: `tests/smoke_all_servers.js`, `tests/tools_list_check.js`, `tests/integration_smoke.js`.

### Architecture decisions

- **3-server split** of the law domain (law-core / parliament / votes) instead of one 14-tool server, per user override.
- **Keep `search_all` as Tier-1 catch-all** plus per-domain specialists, per Anthropic reference patterns (user override vs. Cloudflare Code Mode minimalism).
- **LAN-only** — no Bearer auth, no userConfig.api_token. Deployment target is the `10.0.0.0/16` VPN subnet.
- **Tier-3 tools marked `defer_loading: true`** — forwarded in tools/list so Anthropic Advanced Tool Use surfaces them only via tool_search_tool.

### Known gaps (post-2026-04-14 backend ports)

1 tool still returns 501 pending v7 backend work — see `TODO_BACKEND_NEEDED.md`:
- `science_research_job` — needs design discussion (research backend on .46 / CT-115 not yet bridged via /v1)

The other 6 stubs (`law_get_references`, parliament debate/cosigners/timeline, stat topics/cross-query) were ported to `/v1/` and are now live.
