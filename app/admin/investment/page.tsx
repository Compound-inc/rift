import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/admin-auth";
import InvestmentContent from "./InvestmentContent";

// Force dynamic rendering since we need to access headers for authentication
export const dynamic = 'force-dynamic';

export default async function InvestmentPage() {
  const userIsAdmin = await isAdmin();

  if (!userIsAdmin) {
    redirect("/chat");
  }

  return <InvestmentContent />;
}
