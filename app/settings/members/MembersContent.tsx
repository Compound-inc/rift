"use client";

import { MembersListWithShell } from "./MembersListWithShell";
import { PaginatedOrganizationData } from "@/actions/getOrganizationMembers";

interface MembersContentProps {
  initialData: PaginatedOrganizationData;
  currentUserId: string;
  totalMemberCount: number;
  seatQuantity: number | null;
  plan: "free" | "plus" | "pro" | "enterprise" | null;
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
