# Rift

A workspace covering recruitment, HR, and adjacent product surfaces. This file is a glossary for terms that recur across code, issues, and conversation. It is not a spec.

## Language

### Recruitment

**Position**:
A job opening owned by an organization, with a lifecycle status (`draft`, `open`, `paused`, `filled`). Archived Positions are hidden from the dashboard via `archivedAt`; archive is not a lifecycle status.
_Avoid_: Job, role, vacancy, requisition.

**Candidate**:
A person record, deduped per organization by normalized email. Persists across every Position the same person ever applies to.
_Avoid_: Applicant, person, lead.

**Application**:
The link between one Candidate and one Position, scoped to a single hiring attempt. Carries the pipeline Stage, AI affinity score, CV-on-file, and rejection reason.
_Avoid_: Submission, entry.

**Stage**:
The Application's position in the hiring pipeline (`uploaded`, `scoring`, `awaiting_test`, `evaluating`, `awaiting_verification`, `advanced`, `hired`, `rejected`). Advanced exactly once per workflow step.
_Avoid_: Step, status, phase (when talking about an Application).

**Affinity score**:
The 0–100 score the AI produces for an Application against its Position, with rationale, signals, and the model that produced it. Lives on the Application, never on the Candidate.
_Avoid_: Match score, fit score, AI score, AI verdict.

**Candidate profile**:
The page rooted at `/hr/recruitment/candidates/$candidateId` — the canonical record of one person across every Application they have ever submitted to this organization. Hosts the persona block (name, email, location, etc.) and the activity timeline.
_Avoid_: Candidate page, person page.

**Application detail**:
The sub-page at `/hr/recruitment/candidates/$candidateId/applications/$applicationId` — what the recruiter lands on when clicking a candidate row inside a Position. Foregrounds James-as-applied-to-this-Position: CV, Affinity score, evaluation responses, background check.
_Avoid_: Candidate-for-position page.

**Activity timeline**:
The chronological list on the Candidate profile of every Application the Candidate has, including concurrent ones. Each entry links to its Application detail.
_Avoid_: History, log.

**CV intake**:
The synchronous upload-time path that stores a CV, extracts the first syntactically valid email for Candidate dedup/placeholders, creates the Application, and starts the Application workflow. Candidate persona extraction and Affinity score generation happen later in AI scoring.
_Avoid_: CV ingest, applicant import.

## Relationships

- A **Candidate** has zero or more **Applications**, possibly concurrent
- An **Application** belongs to exactly one **Candidate** and exactly one **Position**
- A **Position** has zero or more **Applications**
- An **Application** carries exactly one **Affinity score** (or none, while still scoring)
- The **Candidate profile** is the parent route of every **Application detail** for that Candidate

### Contracts

- A **Candidate** is always created in the context of an **Application** (e.g. during CV intake). Persona-only Candidates with zero Applications are a defensive fallback, not a supported creation path.

## Flagged ambiguities

- "AI verdict" was used to mean the Affinity score plus its rationale. Resolved: use **Affinity score** as the canonical name; "rationale" is a field on it.
- "Candidate" vs "applicant" — resolved: a person is always a **Candidate**; the act of applying to a Position is an **Application**.
- "Background check" is overloaded. The HR evaluation catalog lists `background` as one **Evaluation** kind (a questionnaire-style assessment dispatched to a Candidate). The third-party report (provider, credit score, legal flags) is a separate concept tracked on its own table. Resolved: the report is a **Background check**; the questionnaire is a **Background evaluation**. They render in separate blocks on the Application detail page.
