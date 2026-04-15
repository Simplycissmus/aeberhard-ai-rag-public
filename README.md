# aeberhard-ai-rag-public

Public marketplace for the `aeberhard-ai-rag` Claude Code plugin — invite-only retrieval over public Swiss legal, parliamentary, scientific and statistical datasets.

## For invited friends

See `plugin/README.md` for install instructions. You will need an API key from the maintainer.

Quick version:

```bash
claude plugin marketplace add Simplycissmus/aeberhard-ai-rag-public
claude plugin install aeberhard-ai-rag@aeberhard-ai-public
export RAG_API_KEY="rgp_your_key_here"   # add to ~/.bashrc or ~/.zshrc
# restart Claude Code
```

## For auditors / curious readers

All plugin code is in `plugin/`. It's small — mostly MCP server glue that calls `https://rag.aeberhard.ai/v1` with your API key. No telemetry beyond HTTP call metadata logged server-side (endpoint, status, timestamp). No query text logged by default.

The proxy source (FastAPI auth + rate limit + collection filter) lives on the maintainer's infrastructure and is not open-source today. Happy to share if asked.

## License

MIT for plugin code. Data sources have their own licenses — see `plugin/README.md`.
