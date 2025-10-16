
import { fetchQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import { getAccessToken } from "@/lib/auth";
import Link from "next/link";
import { Button } from "@/components/ai/ui/button";
import Image from "next/image";

export async function UserProfileSection() {
  const accessToken = await getAccessToken();
  
  let user = null;
  if (accessToken) {
    try {
      user = await fetchQuery(api.users.getCurrentUser, {}, { token: accessToken });
    } catch (error) {
      // If there's an error fetching user data, fall back to unauthenticated state
      console.error("Error fetching user data:", error);
    }
  }


  return (
    <div
      className="border-t border-border p-4 flex-shrink-0 flex items-center"
      style={{ minHeight: "80px" }}
    >
      {user ? (
        // Authenticated state
        <Link href="/settings" className="w-full">
          <div className="flex items-center gap-3 hover:bg-popover-main hover:text-popover-text dark:hover:bg-hover/60 rounded-lg p-2 -m-2 cursor-pointer transition-colors">
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
              <p className="text-sm font-medium truncate">
                {user.firstName && user.lastName
                  ? `${user.firstName} ${user.lastName}`
                  : user.firstName || "User"}
              </p>
            </div>
          </div>
        </Link>
      ) : (
        // Unauthenticated state
        <div className="flex items-center justify-center px-2">
          <Link href="/sign-in" className="w-full">
            <Button size="sm" className="w-full h-10">
              Login
            </Button>
          </Link>
        </div>
      )}
    </div>
  );
}
