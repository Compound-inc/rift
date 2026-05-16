-- HR Recruitment module schema.
--
-- Every table is org-scoped (`organization_id NOT NULL` + composite indexes
-- on `(organization_id, …)`) so cross-org reads are physically impossible
-- via Zero queries that always filter by org first. Archive/trash flows are
-- expressed via `archived_at` columns rather than hard deletes so the
-- platform can always rematch old CVs against new positions.
--
-- See `apps/start/PERMISSIONS.md` and `apps/start/PRODUCTS_AND_ADDONS.md`
-- for how the recruitment + background-check addons sit on top of these
-- tables.

-- ---------------------------------------------------------------------------
-- Positions
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS hr_position (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organization(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  department TEXT NOT NULL DEFAULT '',
  location TEXT NOT NULL DEFAULT '',
  arrangement TEXT NOT NULL DEFAULT 'hybrid',
  employment_type TEXT NOT NULL DEFAULT 'full_time',
  status TEXT NOT NULL DEFAULT 'draft',
  description TEXT NOT NULL DEFAULT '',
  hiring_manager TEXT NOT NULL DEFAULT '',
  compensation TEXT NOT NULL DEFAULT '',
  -- The position description embedding is cached here so stage-1 affinity
  -- scoring (cosine similarity) does not have to re-embed the position for
  -- every CV upload. Refreshed whenever description / requirements change.
  description_embedding JSONB,
  description_embedding_model TEXT,
  description_embedding_dimensions INTEGER,
  description_embedding_updated_at BIGINT,
  tags JSONB NOT NULL DEFAULT '[]'::jsonb,
  recommended_test_kinds JSONB NOT NULL DEFAULT '[]'::jsonb,
  archived_at BIGINT,
  archived_by TEXT,
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL,
  created_by TEXT NOT NULL,
  CONSTRAINT hr_position_status_check CHECK (
    status IN ('draft', 'open', 'paused', 'filled', 'archived')
  ),
  CONSTRAINT hr_position_arrangement_check CHECK (
    arrangement IN ('remote', 'hybrid', 'onsite')
  ),
  CONSTRAINT hr_position_employment_type_check CHECK (
    employment_type IN ('full_time', 'part_time', 'contract', 'internship')
  )
);

CREATE INDEX IF NOT EXISTS hr_position_org
  ON hr_position (organization_id);
CREATE INDEX IF NOT EXISTS hr_position_org_status_updated
  ON hr_position (organization_id, status, updated_at DESC);
CREATE INDEX IF NOT EXISTS hr_position_org_archived_at
  ON hr_position (organization_id, archived_at);

-- ---------------------------------------------------------------------------
-- Test templates (built-in catalog seeded per org + custom additions)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS hr_test_template (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organization(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  -- Default minimum score (0..100) for "passing" the test. Per-position
  -- thresholds override this in `hr_position_test_requirement`.
  default_passing_score INTEGER NOT NULL DEFAULT 70,
  -- Question payload is opaque JSON so we can evolve question shapes
  -- (multiple choice, free text, scenario) without schema migrations.
  questions JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_built_in BOOLEAN NOT NULL DEFAULT FALSE,
  archived_at BIGINT,
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL,
  CONSTRAINT hr_test_template_kind_check CHECK (
    kind IN ('technical', 'honesty', 'background', 'language', 'behavioral', 'custom')
  )
);

CREATE INDEX IF NOT EXISTS hr_test_template_org_kind
  ON hr_test_template (organization_id, kind);
CREATE INDEX IF NOT EXISTS hr_test_template_org_archived
  ON hr_test_template (organization_id, archived_at);

-- ---------------------------------------------------------------------------
-- Position ↔ Test requirements (which tests this position needs)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS hr_position_test_requirement (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organization(id) ON DELETE CASCADE,
  position_id TEXT NOT NULL REFERENCES hr_position(id) ON DELETE CASCADE,
  test_template_id TEXT NOT NULL REFERENCES hr_test_template(id) ON DELETE RESTRICT,
  -- Score the candidate must reach for the workflow to advance to the
  -- next gate. NULL means "use the template default".
  minimum_score INTEGER,
  -- Weight contribution to the final composite score (0..1). The scorer
  -- normalizes weights across the position's required tests.
  weight DOUBLE PRECISION NOT NULL DEFAULT 1.0,
  is_required BOOLEAN NOT NULL DEFAULT TRUE,
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS hr_position_test_requirement_position_template
  ON hr_position_test_requirement (position_id, test_template_id);
CREATE INDEX IF NOT EXISTS hr_position_test_requirement_org_position
  ON hr_position_test_requirement (organization_id, position_id);

-- ---------------------------------------------------------------------------
-- Candidates (org-isolated profiles deduped by normalized email)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS hr_candidate (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organization(id) ON DELETE CASCADE,
  -- normalized_email is the authoritative dedup key inside an org. Stored
  -- separately from the original-cased email so display can preserve case
  -- while lookups remain case-insensitive.
  normalized_email TEXT,
  email TEXT,
  display_name TEXT NOT NULL DEFAULT '',
  phone TEXT,
  -- The most recent CV attached to this candidate. Each application also
  -- records the CV used at upload time, so swapping the active CV later
  -- never rewrites historical applications.
  latest_cv_attachment_id TEXT,
  latest_cv_text TEXT,
  latest_cv_embedding JSONB,
  latest_cv_embedding_model TEXT,
  latest_cv_embedding_dimensions INTEGER,
  latest_cv_indexed_at BIGINT,
  -- Free-form aliases collected as we see the candidate (different name
  -- spellings, alternate emails, etc). Used for future fuzzy matching.
  aliases JSONB NOT NULL DEFAULT '[]'::jsonb,
  tags JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- merged_into_candidate_id lets admins consolidate two profiles when
  -- they're confirmed to be the same person. Soft pointer; the original
  -- row stays for audit. Look-ups follow the chain to the surviving id.
  merged_into_candidate_id TEXT,
  needs_contact_review BOOLEAN NOT NULL DEFAULT FALSE,
  archived_at BIGINT,
  archived_by TEXT,
  notes TEXT,
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS hr_candidate_org_normalized_email
  ON hr_candidate (organization_id, normalized_email)
  WHERE normalized_email IS NOT NULL;
CREATE INDEX IF NOT EXISTS hr_candidate_org_archived
  ON hr_candidate (organization_id, archived_at);
CREATE INDEX IF NOT EXISTS hr_candidate_org_display_name
  ON hr_candidate (organization_id, display_name);

-- ---------------------------------------------------------------------------
-- Applications (Candidate × Position)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS hr_application (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organization(id) ON DELETE CASCADE,
  candidate_id TEXT NOT NULL REFERENCES hr_candidate(id) ON DELETE CASCADE,
  position_id TEXT NOT NULL REFERENCES hr_position(id) ON DELETE CASCADE,
  -- Stage maps 1:1 to the candidate-pipeline workflow nodes so the UI and
  -- the durable run never disagree about progress. See
  -- `lib/shared/hr/recruitment/types.ts` for the canonical enum.
  stage TEXT NOT NULL DEFAULT 'uploaded',
  affinity_score INTEGER,
  affinity_rationale TEXT,
  affinity_signals JSONB,
  affinity_model TEXT,
  cv_attachment_id TEXT,
  cv_text TEXT,
  cv_embedding JSONB,
  cv_embedding_model TEXT,
  -- Workflow run id is captured the moment the candidate-pipeline workflow
  -- starts. Used for cross-referencing in the workflow inspector and for
  -- defensive guards when retrying / aborting.
  workflow_run_id TEXT,
  last_transition_at BIGINT,
  last_error TEXT,
  rejection_reason TEXT,
  hired_at BIGINT,
  archived_at BIGINT,
  archived_by TEXT,
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL,
  CONSTRAINT hr_application_stage_check CHECK (
    stage IN (
      'uploaded',
      'scoring',
      'awaiting_test',
      'evaluating',
      'awaiting_verification',
      'advanced',
      'rejected',
      'hired'
    )
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS hr_application_position_candidate
  ON hr_application (position_id, candidate_id);
CREATE INDEX IF NOT EXISTS hr_application_org_position_score
  ON hr_application (organization_id, position_id, affinity_score DESC);
CREATE INDEX IF NOT EXISTS hr_application_org_stage
  ON hr_application (organization_id, stage);
CREATE INDEX IF NOT EXISTS hr_application_org_candidate
  ON hr_application (organization_id, candidate_id);
CREATE INDEX IF NOT EXISTS hr_application_workflow_run
  ON hr_application (workflow_run_id) WHERE workflow_run_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- Test dispatches and responses
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS hr_test_dispatch (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organization(id) ON DELETE CASCADE,
  application_id TEXT NOT NULL REFERENCES hr_application(id) ON DELETE CASCADE,
  test_template_id TEXT NOT NULL REFERENCES hr_test_template(id) ON DELETE RESTRICT,
  -- Vehicle used to hand the test to the candidate. Today only the
  -- `console_stub` channel exists; real email/SMS adapters land later
  -- behind the same dispatcher service.
  dispatched_via TEXT NOT NULL DEFAULT 'console_stub',
  status TEXT NOT NULL DEFAULT 'sent',
  -- Workflow webhook URL captured at dispatch time. The completion route
  -- uses this URL to resume the suspended workflow once the candidate
  -- submits answers. Storing it here keeps the workflow SDK out of the
  -- HTTP layer.
  resume_webhook_url TEXT,
  -- Idempotency key for retry-safe dispatches. Steps record this before
  -- performing the side effect; a replay of the same step short-circuits
  -- if the key already exists.
  idempotency_key TEXT NOT NULL,
  expires_at BIGINT,
  dispatched_at BIGINT NOT NULL,
  completed_at BIGINT,
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL,
  CONSTRAINT hr_test_dispatch_status_check CHECK (
    status IN ('sent', 'completed', 'expired', 'cancelled')
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS hr_test_dispatch_idempotency
  ON hr_test_dispatch (organization_id, idempotency_key);
CREATE INDEX IF NOT EXISTS hr_test_dispatch_org_application
  ON hr_test_dispatch (organization_id, application_id);
CREATE INDEX IF NOT EXISTS hr_test_dispatch_status
  ON hr_test_dispatch (organization_id, status);

CREATE TABLE IF NOT EXISTS hr_test_response (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organization(id) ON DELETE CASCADE,
  dispatch_id TEXT NOT NULL REFERENCES hr_test_dispatch(id) ON DELETE CASCADE,
  application_id TEXT NOT NULL REFERENCES hr_application(id) ON DELETE CASCADE,
  -- Submitted answers. Shape mirrors the questions JSON on the template.
  answers JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- Computed score 0..100. Null while pending grading (manual or AI).
  score INTEGER,
  -- Auto/Manual signal. Manual entries reflect a human reviewer override.
  scored_by TEXT NOT NULL DEFAULT 'auto',
  passed BOOLEAN,
  submitted_at BIGINT NOT NULL,
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL,
  CONSTRAINT hr_test_response_scored_by_check CHECK (
    scored_by IN ('auto', 'manual', 'pending')
  )
);

CREATE INDEX IF NOT EXISTS hr_test_response_org_application
  ON hr_test_response (organization_id, application_id);
CREATE INDEX IF NOT EXISTS hr_test_response_dispatch
  ON hr_test_response (dispatch_id);

-- ---------------------------------------------------------------------------
-- Background checks (separate addon; rows only created when the workflow
-- branches into the verification stage AND the org has the addon).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS hr_background_check (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organization(id) ON DELETE CASCADE,
  application_id TEXT NOT NULL REFERENCES hr_application(id) ON DELETE CASCADE,
  candidate_id TEXT NOT NULL REFERENCES hr_candidate(id) ON DELETE CASCADE,
  -- Provider key. `mock` is the only supported value today; real adapters
  -- (e.g. checkr, transunion) plug in behind the same service.
  provider TEXT NOT NULL DEFAULT 'mock',
  status TEXT NOT NULL DEFAULT 'pending',
  passed BOOLEAN,
  credit_score INTEGER,
  legal_flags JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- Raw provider payload retained verbatim for audit. The mock provider
  -- writes a believable shape so future real implementations have a clear
  -- migration target.
  raw_payload JSONB,
  resume_webhook_url TEXT,
  idempotency_key TEXT NOT NULL,
  requested_at BIGINT NOT NULL,
  completed_at BIGINT,
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL,
  CONSTRAINT hr_background_check_status_check CHECK (
    status IN ('pending', 'in_progress', 'completed', 'failed', 'cancelled')
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS hr_background_check_idempotency
  ON hr_background_check (organization_id, idempotency_key);
CREATE UNIQUE INDEX IF NOT EXISTS hr_background_check_application
  ON hr_background_check (application_id);
CREATE INDEX IF NOT EXISTS hr_background_check_org_status
  ON hr_background_check (organization_id, status);
