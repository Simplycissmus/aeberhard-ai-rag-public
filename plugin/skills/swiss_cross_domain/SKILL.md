---
name: swiss_cross_domain
description: Build an EXPLICIT comparison MATRIX across 2+ Swiss domains (law/research/politics/statistics). Use ONLY when the user explicitly asks for a comparison, contrast, or matrix output (e.g. "vergleiche Gesetzeslage vs Forschungsstand", "matrix law vs research", "Evidenz UND Gesetzeslage gegenüberstellen"). For general multi-domain briefings/dossiers/overviews, use swiss_rag_research_brief instead.
tools:
  - search_all
  - law_search_articles
  - parliament_search
  - votes_search
  - science_search
  - stat_discover_datasets
---

# Swiss Cross-Domain Synthesis

Compare or combine evidence across Swiss law, parliament, votes, science, and stats in a single answer.

## Workflow

1. `search_all { query, top_k: 15 }` — see which domains light up.
2. Route to the 2-3 domains with highest confidence. For each, call the domain-specific search in parallel.
3. Build a comparison matrix:

   | Domain | Key finding | Citation |
   |---|---|---|
   | Law | <art.> | SR <n> |
   | Parliament | <motion> | <business_nr> |
   | Science | <consensus> | doi:<x> |
   | Stats | <number> | <dataset> |

4. Highlight tensions (e.g. science says X, law still says Y, last motion was in YYYY).

## Constraints

- Do NOT call `chat_ask` — synthesis happens in the agent with grounded chunks.
- If a domain has `no_match` confidence, omit its row rather than fabricating.
- Keep each row to 1-2 sentences. The matrix is the deliverable, not prose.
