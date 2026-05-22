/**
 * Project access predicates shared across Zero mutators and Effect-based
 * server services.
 *
 * The "is this project usable by this caller" rules live in one place here
 * so the four historical copies (project mutators, chat mutators
 * `createThread`/`setProject`, `ThreadService.assertThreadAccess`,
 * `ProjectSourcesAdminService.loadOwnedProject`) cannot drift on the
 * soft-delete / ownership / org-context predicates.
 *
 * The helper deliberately does not perform I/O. Each caller fetches the
 * project row through whatever channel it already has (`tx.run`,
 * `db.run`, …) and passes the row plus the caller's identity here.
 * `checkProjectAccess` returns a discriminated result; the caller maps
 * each failure variant to whichever error type its layer wants to raise.
 */

/**
 * Minimal shape of a `projects` row needed to evaluate access. Every Zero /
 * SQL caller already has at least these columns, so callers can pass the
 * raw row without reshaping it.
 */
export type ProjectAccessSubject = {
  readonly id: string
  readonly userId: string
  readonly organizationId?: string | null
  readonly deletedAt?: number | null
}

/**
 * Org-check policy.
 *
 * - `{ enforce: true, organizationId }`: assert the project's
 *   `organization_id` matches `organizationId` (treating "" / nullish as
 *   "no org" on both sides). Used whenever a thread is being attached to
 *   the project, since a thread's org context must agree with its
 *   project's.
 * - `{ enforce: false }`: skip the org check. Used by project-only
 *   mutators where org context was validated when the project was
 *   created, and is not meaningful for the operation at hand.
 */
export type ProjectAccessOrgPolicy =
  | {
      readonly enforce: true
      readonly organizationId: string | undefined
    }
  | { readonly enforce: false }

export type ProjectAccessResult<TProject extends ProjectAccessSubject> =
  | { readonly kind: 'ok'; readonly project: TProject }
  | { readonly kind: 'not-found' }
  | { readonly kind: 'soft-deleted' }
  | { readonly kind: 'not-owned' }
  | { readonly kind: 'org-mismatch' }

/**
 * Returns `'ok'` only when:
 *   1. `project` is present (else `'not-found'`),
 *   2. `project.deletedAt` is null/undefined (else `'soft-deleted'`),
 *   3. `project.userId === userId` (else `'not-owned'`),
 *   4. when `orgContext.enforce` is true, the project's normalized
 *      organization id equals the caller's normalized organization id
 *      (else `'org-mismatch'`).
 *
 * Step 2 runs before step 3 so a soft-deleted project owned by the caller
 * still surfaces as `'soft-deleted'`, which is more useful for diagnostics
 * than misreporting it as missing.
 */
export function checkProjectAccess<TProject extends ProjectAccessSubject>(
  project: TProject | null | undefined,
  input: {
    readonly userId: string
    readonly orgContext?: ProjectAccessOrgPolicy
  },
): ProjectAccessResult<TProject> {
  if (!project) return { kind: 'not-found' }
  if (project.deletedAt) return { kind: 'soft-deleted' }
  if (project.userId !== input.userId) return { kind: 'not-owned' }
  if (input.orgContext?.enforce) {
    const projectOrgId = project.organizationId?.trim() || undefined
    const callerOrgId = input.orgContext.organizationId?.trim() || undefined
    if (projectOrgId !== callerOrgId) return { kind: 'org-mismatch' }
  }
  return { kind: 'ok', project }
}

/**
 * Stable string codes for the failure variants. Useful when an error
 * surface (e.g. a Zero mutator) wants to encode the reason in its `Error`
 * message rather than carry a structured tag. Codes match the historical
 * `thread_*_project_*` strings the chat mutators used so existing client
 * branching keeps working.
 */
export const PROJECT_ACCESS_FAILURE_CODE = {
  'not-found': 'project_not_found_or_deleted',
  'soft-deleted': 'project_not_found_or_deleted',
  'not-owned': 'project_not_owned',
  'org-mismatch': 'project_org_mismatch',
} as const
