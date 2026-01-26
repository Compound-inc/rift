"use server";

import { withAuth } from "@workos-inc/authkit-nextjs";
import { workos } from "@/app/api/workos";

export async function updateRole(membershipId: string, roleSlug: string) {
  try {
    const { organizationId } = await withAuth({ ensureSignedIn: true });
    
    if (!organizationId) {
      return { success: false, error: "No organization found in session" };
    }

    // Verify the membership belongs to the user's organization
    const membership = await workos.userManagement.getOrganizationMembership(membershipId);
    if (membership.organizationId !== organizationId) {
      return { success: false, error: "Unauthorized: Membership does not belong to your organization" };
    }

    await workos.userManagement.updateOrganizationMembership(membershipId, {
      roleSlug,
    });
    return { success: true };
  } catch (error: any) {
    console.error("Error updating role:", error);
    return { success: false, error: error.message };
  }
}

