'use server';

import { workos } from '@/app/api/workos';
import { withAuth } from '@workos-inc/authkit-nextjs';
import { GeneratePortalLinkIntent } from '@workos-inc/node';

export async function getAuditLogPortalLink(): Promise<string> {
  // Check if the organization has the audit logs entitlement
  // We add a check here since the client side check is not secure enough
  const { organizationId, entitlements } = await withAuth({ ensureSignedIn: true });

  if (!organizationId) {
    throw new Error("No organization found in session");
  }

  const { link } = await workos.portal.generateLink({
    organization: organizationId,
    intent: GeneratePortalLinkIntent.AuditLogs,
  });

  return link;
}
