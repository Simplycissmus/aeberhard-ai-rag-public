# aeberhard-ai-rag (public PoC)

Claude Code plugin for retrieving information from curated public datasets. Swiss-focused (federal law, parliament, court decisions, popular votes) with European statistics (Eurostat, OECD) and global scientific literature (OpenAlex, arXiv).

**Status:** private invite-only proof-of-concept for a small circle of friends. Not production. No warranties. Fair-use rate limiting.

## What it can look up

- **Swiss federal law** (Fedlex) — 544'000 articles across all federal laws and ordinances (SR numbers)
- **Swiss Federal Court decisions** (BGer) — 9.47 million case decisions
- **Swiss Parliament** (Curia Vista) — 64'000 parliamentary business items, motions, interpellations
- **Popular votes** (Swissvotes) — 708 federal votes 1848–today
- **Scientific papers** — 92'000 papers from OpenAlex + arXiv
- **Statistics** — Eurostat (7'000 datasets), OECD (1'400), Swiss BFS/PxWeb (540)

Primary language is German. French, Italian, English also work.

## What it does NOT do

- No private data. Only the public collections listed above are exposed.
- No chat-session persistence or admin endpoints. Pure read-only retrieval.
- No LLM generation — this is retrieval only. Your Claude Code session does the reasoning over the results.

## Install

You need:
- Claude Code installed and working ([docs](https://code.claude.com))
- An invite from the maintainer — you will receive an **API key** that looks like `rgp_...`

Then:

```bash
# 1. Add the marketplace (one-time)
claude plugin marketplace add Simplycissmus/aeberhard-ai-rag-public

# 2. Install the plugin
claude plugin install aeberhard-ai-rag@aeberhard-ai-public

# 3. Export your API key in your shell profile (~/.bashrc or ~/.zshrc)
echo 'export RAG_API_KEY="rgp_paste_your_key_here"' >> ~/.bashrc
source ~/.bashrc

# 4. Restart Claude Code
```

Verify:

```
> /mcp
```

You should see six `aeberhard-ai-rag` servers listed (rag-core, rag-law-core, rag-parliament, rag-votes, rag-stats, rag-science), all `✓ Connected`.

Try:

```
> Was sagt die Schweizer Verfassung zur Gleichstellung?
> Welche parlamentarischen Vorstösse gibt es zu Klimapolitik seit 2022?
> Gibt es wissenschaftliche Studien zu Lohngleichheit in der Schweiz?
```

## Auto-updates

The plugin updates automatically from GitHub when you restart Claude Code, as long as `FORCE_AUTOUPDATE_PLUGINS=1` is set in your shell environment. Add to your profile:

```bash
export FORCE_AUTOUPDATE_PLUGINS=1
```

## What gets logged

For each API call, the proxy records:
- Which API key (by ID, not plaintext)
- Endpoint path (e.g. `/v1/law/articles/search`)
- HTTP status code
- Timestamp

Query text is **not** logged by default. Log files live on the maintainer's server and are kept for operational reasons (rate-limit debugging, abuse detection). They are not shared with third parties.

## Rate limiting

Fair-use limit: 200 requests per hour per API key. If exceeded you get HTTP 429 and the plugin will retry on subsequent calls.

## Disclaimers

- **Not legal advice.** The law articles returned are the public text. Consult a qualified professional for legal matters.
- **Not medical/scientific advice.** Paper abstracts are retrieved as-is. Read the full papers for context.
- **Retrieval, not truth.** Results come from semantic search + reranker; they are ranked by relevance, not correctness. Cross-check before citing.
- **No uptime guarantee.** This is a side project. It may be down, slow, or deprecated at any time.

## Data sources and licenses

| Data | Source | License |
|---|---|---|
| Fedlex | [fedlex.admin.ch](https://www.fedlex.admin.ch) | public domain |
| BGer decisions | [bger.ch](https://www.bger.ch) | public domain |
| Curia Vista | [parlament.ch](https://www.parlament.ch) | public domain |
| Swissvotes | [swissvotes.ch](https://swissvotes.ch) | CC BY-NC-SA |
| OpenAlex / arXiv | [openalex.org](https://openalex.org) / [arxiv.org](https://arxiv.org) | CC0 / various |
| Eurostat | [ec.europa.eu/eurostat](https://ec.europa.eu/eurostat) | CC BY |
| OECD | [oecd.org](https://www.oecd.org) | OECD terms |
| BFS / PxWeb | [bfs.admin.ch](https://www.bfs.admin.ch) | open data |

## Plugin code license

MIT — see [LICENSE](./LICENSE). The plugin source is intentionally public so you can audit exactly what it does.

## Feedback

If you're one of the invited friends and something doesn't work, ping the maintainer. Keep in mind it's a side project — expect "I'll look at it when I can" rather than 24/7 support.
