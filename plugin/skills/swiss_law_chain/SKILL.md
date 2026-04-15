---
name: swiss_law_chain
description: Trace a legal topic from statute to case law to parliamentary origin to popular vote. Triggers on "full legal chain", "statute + case law", "Rechtskette", "Gesetz + Rechtsprechung", "von der Motion zum Gesetz".
tools:
  - law_search_articles
  - law_get_law
  - law_search_decisions
  - law_get_decision
  - law_get_references
  - parliament_search
  - votes_search
---

# Swiss Law Chain

Given a legal topic, produce a citation chain: relevant article(s) → leading BGer case(s) → originating parliamentary business → any popular vote that touched the area.

## Workflow

1. `law_search_articles { query, top_k: 5 }` — find the statutory anchor(s).
2. For the top-1 hit, `law_get_law { sr_number }` — fetch the law's title + summary + full article list.
3. `law_search_decisions { query, top_k: 5 }` — find leading BGer rulings on the same topic.
4. For the top-2 rulings, `law_get_decision { decision_id }` — fetch full regeste + considerations.
5. `parliament_search { query }` — find parliamentary businesses that led to or amended the law.
6. `votes_search { query }` — find any popular vote on the subject (referendums, initiatives).
7. (Optional) `law_get_references` for cross-reference chains — currently returns 501, skip gracefully.

## Output shape

Citation-chain list with each hop linked to the next. Include SR number, article number, BGE citation, business number, vote anr.

## Constraints

- Stop after step 6 even if confidence stays low — don't loop.
- If step 1 returns confidence `no_match`, short-circuit and tell the user "no statutory anchor found, try rephrasing" rather than fabricating a chain.
