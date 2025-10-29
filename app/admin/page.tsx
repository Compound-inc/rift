import { redirect } from "next/navigation";
import { isAdmin, getCurrentUserEmail } from "@/lib/admin-auth";
import AdminDashboardClient from "./AdminDashboardClient";

export default async function AdminPage() {
  // Check if user is admin
  const userIsAdmin = await isAdmin();
  
  if (!userIsAdmin) {
    // Redirect non-admin users to chat page
    redirect("/chat");
  }

  // Get current user's email for confirmation
  const userEmail = await getCurrentUserEmail();

  return (
    <div className="min-h-screen bg-background dark:bg-popover-main">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-foreground dark:text-popover-text mb-2">
              Admin Dashboard
            </h1>
            <p className="text-muted-foreground dark:text-popover-text/70">
              Manage organizations, assign plans, and reset billing cycles.
            </p>
          </div>

          {/* Admin Access Confirmation */}
          <div className="bg-green-50 dark:bg-accent-green/20 border border-green-200 dark:border-border rounded-lg p-6 mb-8">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <svg
                  className="h-5 w-5 text-green-400"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-green-800 dark:text-popover-text">
                  Admin Access Confirmed
                </h3>
                <div className="mt-2 text-sm text-green-700 dark:text-popover-text/80">
                  <p>
                    You are logged in as: <span className="font-mono font-medium">{userEmail}</span>
                  </p>
                  <p className="mt-1">
                    This email is authorized for administrative access.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Organizations Management */}
          <AdminDashboardClient />
        </div>
      </div>
    </div>
  );
}
