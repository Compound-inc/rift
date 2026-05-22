# RAG retrieval unions all four context sources for project threads

When a Thread belongs to a Project, retrieval-augmented generation pulls
chunks from the union of four sources every turn:

1. Per-message attachments (files dropped into the composer for this turn)
2. Per-thread attachments (files attached to the Thread itself)
3. Project files (files attached to the Thread's Project)
4. Org-knowledge files (org-wide admin-curated corpus)

Considered scoping retrieval to Project + per-message/per-thread only (i.e.
suppressing org-knowledge when a Project is active) on the grounds that the
user "explicitly chose" the Project's context. Rejected for v1 to maximise
recall and avoid surprising starvation when the org-knowledge corpus
genuinely is relevant. The chosen policy is the most additive of the
plausible options — narrowing it later (e.g. excluding org-knowledge from
project threads, or gating it behind a per-Project toggle) does not require a
schema change.

Implementation-wise the orchestrator branches by source: per-message and
per-thread attachments flow through `attachment-rag.service.ts`; org-knowledge
flows through `org-knowledge-rag.service.ts`; project files flow through a
new `project-rag.service.ts` modelled on the org-knowledge service and
filtered by `projectId`. Top-K and score thresholds remain per-source; the
orchestrator merges results before assembling the prompt.

Risk: token cost goes up and source attribution (`message.sources`) must
identify which of the four buckets each citation came from, so users can
diagnose surprising retrievals.
