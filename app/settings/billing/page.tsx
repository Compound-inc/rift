import { withAuth } from "@workos-inc/authkit-nextjs";
import { BillingPageContent } from "./BillingPageContent";
import { hasPermissions } from "@/lib/permissions";
import { redirect } from "next/navigation";

export default async function BillingPage() {
  await withAuth();

  const permissions = await hasPermissions(["MANAGE_BILLING"]);
  
  if (!permissions.MANAGE_BILLING) {
    redirect("/settings/profile");
  }

  return (
    <BillingPageContent />
  );
}

