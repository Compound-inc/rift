# In-org permission gating deferred for HR PII surfaces

The Candidate profile and Application detail pages are gated by org membership only — anyone in the org with HR access sees the full persona, CV, AI affinity, evaluations, and background check. There is no in-org permission tier for HR PII in v1, matching the existing HR pages (positions, applications) which also gate only by org.

The alternatives — gating just the background check block, or layering tiered permissions across all blocks — were rejected because HR-scoped permissions (recruiter vs hiring manager vs admin, what they each see, what they each can do) is its own design problem. Bolting partial gating into this feature would create a second permission model diverging from the rest of HR and would either over-design or under-design.

The natural cut points for a future tiered model are: persona/CV (basic), AI signals/evaluations (intermediate), background check / credit data (sensitive). When that work happens, this ADR becomes the explicit "we knew" record: PII access in v1 was deliberate, not an oversight, and was scoped to org membership pending the broader HR permission design.
