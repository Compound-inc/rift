"use client";

import { MembersListWithShell } from "./MembersListWithShell";
import {
  PaginatedOrganizationData,
  type OrganizationPlan,
} from "@/actions/getOrganizationMembers";

interface MembersContentProps {
  initialData: PaginatedOrganizationData;
  currentUserId: string;
  totalMemberCount: number;
  seatQuantity: number | null;
  plan: OrganizationPlan | null;
}

export function MembersContent({
  initialData,
  currentUserId,
  totalMemberCount,
  seatQuantity,
  plan,
}: MembersContentProps) {
  return (
    <MembersListWithShell
      initialData={initialData}
      currentUserId={currentUserId}
      seatQuantity={seatQuantity}
      totalMemberCount={totalMemberCount}
      plan={plan}
    />
  );
}
