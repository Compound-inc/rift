"use server";

import { withAuth } from "@workos-inc/authkit-nextjs";
import { workos } from "@/app/api/workos";

export async function revokeInvitation(invitationId: string) {
  try {
    const { organizationId } = await withAuth({ ensureSignedIn: true });
    
    if (!organizationId) {
      return { success: false, error: "No organization found in session" };
    }

    // Verify the invitation belongs to the user's organization
    const invitation = await workos.userManagement.getInvitation(invitationId);
    if (invitation.organizationId !== organizationId) {
      return { success: false, error: "Unauthorized: Invitation does not belong to your organization" };
    }

    await workos.userManagement.revokeInvitation(invitationId);
    return { success: true };
  } catch (error: any) {
    console.error("Error revoking invitation:", error);
    return { success: false, error: error.message };
  }
}

