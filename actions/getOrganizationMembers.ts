"use server";

import { workos } from "@/app/api/workos";
import { OrganizationMembership, User, Invitation } from "@workos-inc/node";

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
  organizationId: string,
  limit: number = 50,
  after?: string,
  before?: string
): Promise<PaginatedOrganizationData> {
  try {
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

export async function getOrganizationMemberCount(organizationId: string): Promise<number> {
  const [membershipCount, invitationCount] = await Promise.all([
    countAllMemberships(organizationId),
    countPendingInvitations(organizationId)
  ]);
  return membershipCount + invitationCount;
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
