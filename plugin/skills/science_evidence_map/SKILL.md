---
name: science_evidence_map
description: Map the research landscape on a topic — find papers, cluster by subtopic, and surface citation hubs. Triggers on "what does research say", "evidence on", "Literaturstand", "systematic review", "citation cluster".
tools:
  - science_search
  - science_list_topics
  - science_run_sql
  - science_research_job
---

# Science Evidence Map

Build an evidence map on a research question.

## Workflow

1. `science_list_topics` — optional, to pick a topic filter if the question is broad.
2. `science_search { query, top_k: 20 }` — retrieve candidate papers. Note topic distribution.
3. For the top papers, collect DOIs, venues, citation counts.
4. `science_run_sql` — analyse the citation graph:
   ```sql
   SELECT p.title, p.year, p.venue,
          (SELECT COUNT(*) FROM citations c WHERE c.dst = p.id) AS cited_by_n
   FROM papers p
   WHERE p.id IN (<top_ids>)
   ORDER BY cited_by_n DESC
   ```
5. (Optional) `science_research_job { action: 'submit', query, depth: 'medium' }` — for a deep, multi-paper synthesis. *Note: 501 in v7 today — skip.*
6. Present an evidence map: cluster → papers → citation hubs.

## Output shape

```
# Evidence map: <topic>

## Clusters
1. <subtopic>: N papers, hub = <top-cited paper>
2. ...

## Highly-cited papers
- <authors> (<year>). <title>. <venue>. doi:<doi>. Cited by <N>.

## Gaps
<what's missing or recent>
```

## Constraints

- Only cite papers returned by science_search — never invent DOIs.
- For Swiss-specific questions set topic or query to bias toward policy-relevant subset.
