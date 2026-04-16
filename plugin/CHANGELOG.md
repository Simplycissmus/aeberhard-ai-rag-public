# CHANGELOG

## 1.0.1 — 2026-04-16 (security hardening)

- **SSRF guard in `lib/api-client.js`:** pin outbound host to the `RAG_API_URL` origin. Rejects any full-URL override that points elsewhere. Closes latent SSRF primitive flagged in audit.
- **No stack-trace leakage:** `lib/server-framework.js` no longer returns JavaScript stack traces to the Claude conversation — errors are logged to stderr on the plugin side, and Claude receives a generic "internal error" message. Closes file-path disclosure flagged in audit.
- Scrubbed internal LAN addresses from CHANGELOG and test scripts.

## 1.0.0 — 2026-04-16

- First public release of the aeberhard-ai-rag plugin.
- 6 MCP servers (core, law-core, parliament, votes, stats, science)
- 6 SKILL.md playbooks
- Points at `https://rag.aeberhard.ai/v1` via `X-API-Key` auth
- Read-only retrieval, rate-limited (200/h per key), public collections only
- Forked from internal `aeberhard-ai-rag` v2.1.0, stripped for public scope

