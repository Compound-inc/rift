import { describe, expect, it } from 'vitest'
import { Effect } from 'effect'
import { OrgKnowledgeAdminService } from '@/lib/backend/org-knowledge/services/org-knowledge-admin.service'
import { OrgKnowledgeRuntime } from './org-knowledge-runtime'

/**
 * The org-knowledge runtime is used by TanStack Start server functions.
 * Verifying that the runtime can resolve the admin service catches wiring
 * mistakes before they surface as runtime-only `Service not found` failures.
 */
describe('OrgKnowledgeRuntime', () => {
  it('resolves the admin service from the production runtime graph', async () => {
    const result = await OrgKnowledgeRuntime.run(
      Effect.gen(function* () {
        const adminService = yield* OrgKnowledgeAdminService
        return typeof adminService.uploadKnowledgeFile
      }),
    )

    expect(result).toBe('function')
  })
})
