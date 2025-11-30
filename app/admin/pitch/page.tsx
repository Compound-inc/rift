import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/admin-auth";
import PitchContent from "./PitchContent";

// Force dynamic rendering since we need to access headers for authentication
export const dynamic = 'force-dynamic';

export default async function PitchPage() {
  // Check if user is admin
  const userIsAdmin = await isAdmin();
  
  if (!userIsAdmin) {
    // Redirect non-admin users to chat page
    redirect("/chat");
  }

  return <PitchContent />;
}
