"use server";

import { withAuth } from "@workos-inc/authkit-nextjs";
import { workos } from "@/app/api/workos";
type WidgetScope = 'widgets:users-table:manage' | 'widgets:sso:manage' | 'widgets:domain-verification:manage' | 'widgets:api-keys:manage';

export type GetWorkOSWidgetTokenResult =
  | { success: true; token: string }
  | { success: false; error: string };

export async function getWorkOSWidgetToken(
  scopes: WidgetScope[]
): Promise<GetWorkOSWidgetTokenResult> {
  try {
    const { user, organizationId } = await withAuth({ ensureSignedIn: true });
    
    if (!user?.id) {
      return {
        success: false,
        error: "User not authenticated",
      };
    }

    if (!organizationId) {
      return {
        success: false,
        error: "No organization found in session",
      };
    }
    
    const token = await workos.widgets.getToken({
      organizationId,
      userId: user.id,
      scopes,
    });
    
    return { success: true, token };
  } catch (error) {
    console.error("[widget-token] Failed to get WorkOS widget token", { error });
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to get widget token",
    };
  }
}
