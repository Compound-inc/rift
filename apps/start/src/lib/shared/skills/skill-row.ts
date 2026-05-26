/**
 * Canonical `skill` row shape, shared across UI, mutators, resolver, and tests.
 * `?: T | null` mirrors the SQL nullability for `organization_id`,
 * `project_id`, `description`, and `deleted_at`.
 */
export type SkillRow = {
  readonly id: string
  /** Original creator. The permission anchor for personal/org-shared skills. */
  readonly userId: string
  readonly organizationId?: string | null
  readonly projectId?: string | null
  readonly name: string
  readonly body: string
  readonly description?: string | null
  /** Org-admin co-edit opt-in. Meaningful only when `organizationId` is set. */
  readonly allowAdminEdit: boolean
  readonly deletedAt?: number | null
  readonly createdAt?: number
  readonly updatedAt?: number
}
