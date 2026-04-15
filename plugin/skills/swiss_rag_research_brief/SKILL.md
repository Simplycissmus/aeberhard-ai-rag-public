---
name: swiss_rag_research_brief
description: Build a grounded multi-domain research brief on a Swiss policy topic (law + parliament + votes + science + stats). Triggers on "brief", "dossier", "research", "overview", "Dossier", "Übersicht" when the scope is Switzerland.
tools:
  - rag_meta
  - search_all
  - law_search_articles
  - law_search_decisions
  - parliament_search
  - votes_search
  - science_search
  - stat_discover_datasets
  - chat_ask
---

# Swiss RAG Research Brief

Build a grounded, multi-source briefing on a Swiss policy topic. Output should cite SR numbers, BGE references, Curia Vista business numbers, Swissvotes anr, and paper DOIs.

## Workflow

1. `rag_meta` once — confirms which collections are live and which are degraded.
2. `search_all { query, top_k: 10 }` — broad first pass to see which domains have hits.
3. For every domain with ≥1 high-confidence hit (≥0.72 cosine), run the domain-specific search:
   - Law → `law_search_articles` + `law_search_decisions`
   - Parliament → `parliament_search`
   - Votes → `votes_search`
   - Science → `science_search`
   - Stats → `stat_discover_datasets`
4. For each hit cluster (≥3 hits on the same SR-number / anr / topic), drill once with the `*_get_*` tool.
5. Synthesise manually in the final answer — do NOT call `chat_ask` for the synthesis (it adds latency and the agent already has the grounded chunks).

## Output shape

```
# <Topic> — Swiss policy brief (DE / FR / EN mixed OK)

## Legal framework
- SR <number> <title>. Art. <n>: "<quote>". (Fedlex)
- BGE <citation>: <regeste>. (BGer)

## Parliamentary activity
- Motion <business_number> <title> (<author>, <year>). Status: <status>.

## Popular votes
- <date> — <title> (anr <anr>). Accepted/Rejected. Yes-share: <pct>%.

## Research evidence
- <authors> (<year>). <title>. <venue>. doi:<doi>.

## Statistical indicators (if relevant)
- Dataset <id> from <source>. Schema: <mapping>.
- SQL used: <template>.
```

## Constraints

- Never fabricate an SR number, BGE citation, business number, or DOI. If unsure, omit.
- Always surface `confidence.level` to the user when it is `low` or `no_match`.
- Prefer primary sources (law_*, votes_*, parliament_*) over synthesised chat output.
