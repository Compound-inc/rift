// PREVIEW-ONLY helper (untracked): recompute an org entitlement snapshot.
import { recomputeOrgEntitlementSnapshot } from '@/lib/backend/billing/integrations/auth-billing-hooks'
const orgId = process.argv[2]!
console.log(await recomputeOrgEntitlementSnapshot(orgId))
process.exit(0)
