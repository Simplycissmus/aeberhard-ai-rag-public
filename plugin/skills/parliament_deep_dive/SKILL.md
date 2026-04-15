---
name: parliament_deep_dive
description: Full political biography of a Swiss parliamentary business item — who, when, what it became. Triggers on "Wer hat Motion X eingereicht", "Debatte zu", "Geschichte von Postulat", "cosigners", "Abstimmung im NR / SR".
tools:
  - parliament_search
  - parliament_get_business
  - parliament_get_debate
  - parliament_get_cosigners
  - parliament_get_timeline
  - parliament_run_sql
  - votes_search
---

# Parliament Deep Dive

Produce a full political biography of a parliamentary business item.

## Workflow

1. If the user gave a business number (e.g. `23.4567`) skip to step 3.
2. Otherwise `parliament_search { query, top_k: 5 }` to locate the item.
3. `parliament_get_business { business_number }` — metadata (author, department, status, abstract).
4. `parliament_get_timeline { business_number }` — lifecycle events (committee, vote, withdrawal). *Note: 501 in v7 today — fall back to business.status and linked votes.*
5. `parliament_get_cosigners { business_number }` — cosigner roster. *Note: 501 in v7 — basic list may still be in step 3's response.*
6. `parliament_get_debate { business_number }` — debate transcript. *Note: 501 in v7 — skip if unavailable and say so.*
7. `votes_search { query: <item title> }` — surface any federal vote that emerged.
8. (Optional) `parliament_run_sql` to find related items by the same author or in the same domain.

## Output shape

```
# Motion <nr> — <title>

**Author:** <name> (<party>, <canton>)
**Submitted:** <date>   **Status:** <status>   **Department:** <dept>

## Abstract
<abstract>

## Cosigners (N)
<list if available>

## Timeline
<events if available>

## Debate highlights
<transcript snippets if available>

## Related popular vote(s)
<if any>
```

## Constraints

- If steps 4-6 return 501 (not-yet-wired), continue with the remaining data rather than aborting.
- Always cite the business number verbatim (format `YY.NNNN`).
