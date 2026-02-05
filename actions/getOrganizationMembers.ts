"use server";

import { withAuth } from "@workos-inc/authkit-nextjs";
import { workos } from "@/app/api/workos";
import { OrganizationMembership, User, Invitation } from "@workos-inc/node";
import { fetchQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import { getAutumnSeatLimitForOrg } from "./getAutumnSeatLimit";

export interface OrganizationMembershipWithUser extends OrganizationMembership {
  user: User | null;
}

export interface PaginatedOrganizationData {
  members: OrganizationMembershipWithUser[];
  invitations: Invitation[];
  nextCursor: string | null;
  prevCursor: string | null;
}

export async function getPaginatedOrganizationMembers(
  limit: number = 50,
  after?: string,
  before?: string
): Promise<PaginatedOrganizationData> {
  try {
    const { organizationId } = await withAuth({ ensureSignedIn: true });
    
    if (!organizationId) {
      return { members: [], invitations: [], nextCursor: null, prevCursor: null };
    }

    // Standard Pagination
    const membershipsResponse = await workos.userManagement.listOrganizationMemberships({
      organizationId,
      limit,
      after,
      before,
      order: 'desc',
    });

    const memberships = membershipsResponse.data;
    const nextCursor = membershipsResponse.listMetadata.after || null;
    const prevCursor = membershipsResponse.listMetadata.before || null;

    const membersWithUsers = await Promise.all(memberships.map(async (m) => {
        try {
            const user = await workos.userManagement.getUser(m.userId);
            return { ...m, user };
        } catch (e) {
            console.warn(`Failed to fetch user ${m.userId}`, e);
            return { ...m, user: null };
        }
    }));
    
    // Fetch all pending invitations (only on first page to avoid complexity)
    // Paginate through all invitations to ensure we get all pending ones
    const invitations = (!after && !before) 
      ? await getAllPendingInvitations(organizationId)
      : [];

    return {
      members: membersWithUsers,
      invitations: invitations,
      nextCursor,
      prevCursor
    };

  } catch (error) {
    console.error("Error fetching paginated members:", error);
    return { members: [], invitations: [], nextCursor: null, prevCursor: null };
  }
}

export async function getOrganizationMemberCount(): Promise<number> {
  const { organizationId } = await withAuth({ ensureSignedIn: true });
  
  if (!organizationId) {
    throw new Error("No organization found in session");
  }

  const [membershipCount, invitationCount] = await Promise.all([
    countAllMemberships(organizationId),
    countPendingInvitations(organizationId)
  ]);
  return membershipCount + invitationCount;
}

/** Returns plan from Convex and seat limit from Autumn (only when plan is Enterprise). */
export async function getOrganizationPlanAndSeatLimit(): Promise<{
  seatQuantity: number | null;
  plan: "free" | "plus" | "pro" | "enterprise" | null;
}> {
  try {
    const { organizationId } = await withAuth({ ensureSignedIn: true });
    if (!organizationId) {
      throw new Error("No organization found in session");
    }

    const plan = await fetchQuery(api.organizations.getOrganizationPlan, {
      workos_id: organizationId,
      secret: process.env.CONVEX_SECRET_TOKEN!,
    });

    const seatQuantity =
      plan === "enterprise" ? await getAutumnSeatLimitForOrg(organizationId) : null;

    return { seatQuantity, plan };
  } catch (error) {
    console.error("Error fetching plan and seat limit:", error);
    return { seatQuantity: null, plan: null };
  }
}

async function countAllMemberships(organizationId: string): Promise<number> {
  let count = 0;
  let after: string | undefined = undefined;

  do {
    const { data, listMetadata } = await workos.userManagement.listOrganizationMemberships({
      organizationId,
      after,
      limit: 100,
    });
    
    count += data.length;
    after = listMetadata.after;
  } while (after);

  return count;
}


async function countPendingInvitations(organizationId: string): Promise<number> {
  const pendingInvitations = await getAllPendingInvitations(organizationId);
  return pendingInvitations.length;
}

/**
 * Fetches all organization memberships with their user data.
 * Paginates through all pages and enriches with user information.
 */
async function getAllMembershipsWithUsers(organizationId: string): Promise<OrganizationMembershipWithUser[]> {
  let allMemberships: OrganizationMembership[] = [];
  let after: string | undefined = undefined;

  // Fetch all memberships
  do {
    const { data, listMetadata } = await workos.userManagement.listOrganizationMemberships({
      organizationId,
      after,
      limit: 100,
    });
    
    allMemberships = allMemberships.concat(data);
    after = listMetadata.after;
  } while (after);

  // Enrich with user data
  const membershipsWithUsers = await Promise.all(allMemberships.map(async (m) => {
    try {
      const user = await workos.userManagement.getUser(m.userId);
      return { ...m, user };
    } catch (e) {
      console.warn(`Failed to fetch user ${m.userId}`, e);
      return { ...m, user: null };
    }
  }));

  return membershipsWithUsers;
}

/**
 * Fetches all pending invitations for an organization.
 */
async function getAllPendingInvitations(organizationId: string): Promise<Invitation[]> {
  let allPendingInvitations: Invitation[] = [];
  let after: string | undefined = undefined;

  do {
    const { data, listMetadata } = await workos.userManagement.listInvitations({
      organizationId,
      after,
      limit: 100,
    });
    
    // Filter and collect pending invitations only
    const pending = data.filter(inv => inv.state === 'pending');
    allPendingInvitations = allPendingInvitations.concat(pending);
    after = listMetadata.after;
  } while (after);

  return allPendingInvitations;
}
