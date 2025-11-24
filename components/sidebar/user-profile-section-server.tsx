
import { fetchQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import { getAccessToken } from "@/lib/auth";
import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ai/ui/button";
import { Badge } from "@/components/ui/badge";

import { cn } from "@/lib/utils";

function getPlanBadgeStyles(plan: string) {
  switch (plan) {
    case "free":
      return "border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50 text-zinc-500 dark:text-zinc-400 group-hover:bg-zinc-100 group-hover:dark:bg-zinc-900/70";
    case "plus":
      return "border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-300 group-hover:bg-blue-100 group-hover:dark:bg-blue-900/40 group-hover:text-blue-700";
    case "pro":
      return "border-purple-200 dark:border-purple-800 bg-purple-50/50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-300 group-hover:bg-purple-100 group-hover:dark:bg-purple-900/40 group-hover:text-purple-700";
    case "enterprise":
      return "border-amber-300 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 group-hover:bg-amber-100 group-hover:dark:bg-amber-900/40 group-hover:text-amber-800";
    default:
      return "border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50 text-zinc-500 dark:text-zinc-400 group-hover:bg-zinc-100 group-hover:dark:bg-zinc-900/70";
  }
}

export async function UserProfileSection() {
  const accessToken = await getAccessToken();
  
  let user = null;
  let orgInfo = null;
  if (accessToken) {
    try {
      const [userData, orgData] = await Promise.all([
        fetchQuery(api.users.getCurrentUser, {}, { token: accessToken }),
        fetchQuery(api.organizations.getCurrentOrganizationInfo, {}, { token: accessToken })
      ]);
      user = userData;
      orgInfo = orgData;
    } catch (error) {
      // If there's an error fetching user data, fall back to unauthenticated state
      console.error("Error fetching user data:", error);
    }
  }


  return (
    <div
      className="border-t border-border p-4 flex-shrink-0 flex items-center justify-center"
      style={{ minHeight: "80px" }}
    >
      {user ? (
        // Authenticated state
        <Link href="/settings/usage" className="w-full">
          <div className="group flex items-center gap-3 hover:bg-popover-main hover:text-popover-text dark:hover:bg-hover/60 rounded-lg p-2 -m-2 cursor-pointer transition-colors">
            <div className="h-8 w-8 rounded-full overflow-hidden bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-700 dark:to-gray-800 flex-shrink-0">
              {user.profilePictureUrl ? (
                <Image
                  src={user.profilePictureUrl}
                  alt={user.firstName || "User"}
                  width={32}
                  height={32}
                  className="w-full h-full object-cover"
                  priority
                />
              ) : (
                <Image
                  src="/avatar.png"
                  alt="Default avatar"
                  width={32}
                  height={32}
                  className="w-full h-full object-cover"
                  priority
                />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex flex-col items-start gap-0.5">
                <p className="text-sm font-medium truncate">
                  {user.firstName && user.lastName
                    ? `${user.firstName} ${user.lastName}`
                    : user.firstName || "User"}
                </p>
                {orgInfo?.plan && (
                  <Badge 
                    variant="outline" 
                    className={cn(
                      "h-5 px-2 text-[10px] font-medium capitalize rounded-full shadow-none",
                      getPlanBadgeStyles(orgInfo.plan)
                    )}
                  >
                    {orgInfo.plan}
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </Link>
      ) : (
        // Unauthenticated state
        <Link href="/sign-in" className="w-full">
          <Button
            className="w-full bg-accent hover:bg-accent/90 text-white rounded-lg font-medium"
          >
            Iniciar sesión
          </Button>
        </Link>
      )}
    </div>
  );
}
