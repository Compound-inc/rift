'use server';

import { refreshSession, withAuth } from '@workos-inc/authkit-nextjs';
import { workos } from '@/app/api/workos';

type EnsureWorkosOrganizationArgs = {
  /**
   * Optional org name used only when the user has no org and we need to create one.
   */
  orgName?: string;
  /**
   * Optional explicit organizationId to prefer.
   */
  organizationId?: string | null;
};

export async function ensureWorkosOrganization(
  args: EnsureWorkosOrganizationArgs = {},
): Promise<{ organizationId: string }> {
  const session = await withAuth({ ensureSignedIn: true });

  const userId = session.user?.id;
  if (!userId) {
    throw new Error('Unauthorized');
  }

  const preferredOrgId = args.organizationId ?? session.organizationId ?? null;
  if (preferredOrgId) {
    return { organizationId: preferredOrgId };
  }

  const memberships = await workos.userManagement.listOrganizationMemberships({
    userId,
  });

  const existingOrgId = memberships.data[0]?.organizationId ?? null;
  if (existingOrgId) {
    // Refresh session so the browser cookies/JWT reflect the org context.
    await refreshSession({ ensureSignedIn: true, organizationId: existingOrgId });
    return { organizationId: existingOrgId };
  }

  const name = String(args.orgName ?? '').trim();
  if (!name) {
    throw new Error('Organization Name is required to create a new organization');
  }
  if (name.length > 50) {
    throw new Error('Organization Name must be at most 50 characters');
  }

  const organization = await workos.organizations.createOrganization({ name });

  await workos.userManagement.createOrganizationMembership({
    organizationId: organization.id,
    userId,
    roleSlug: 'admin',
  });

  await refreshSession({ ensureSignedIn: true, organizationId: organization.id });

  return { organizationId: organization.id };
}

