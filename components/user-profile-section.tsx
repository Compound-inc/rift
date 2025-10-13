import { useAuth } from "@workos-inc/authkit-nextjs/components";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ai/ui/avatar";
import Link from "next/link";
import { Button } from "@/components/ai/ui/button";
import Image from "next/image";
import { useEffect, useState } from "react";

export function UserProfileSection() {
  const { user, loading } = useAuth();
  const [isHydrated, setIsHydrated] = useState(false);

  // Track hydration to prevent layout shift
  useEffect(() => {
    setIsHydrated(true);
  }, []);

  return (
    <div
      className="border-t border-border p-4 flex-shrink-0 flex items-center"
      style={{ minHeight: "80px" }}
    >
      {!isHydrated ? (
        // During SSR/hydration, show a neutral state with consistent dimensions
        <div className="flex items-center gap-3 opacity-0">
          <Avatar className="h-8 w-8">
            <AvatarFallback>
              <Image
                src="/avatar.png"
                alt="Loading"
                width={38}
                height={38}
                className="w-full h-full object-cover"
              />
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium">Loading...</p>
          </div>
        </div>
      ) : loading ? (
        // Show loading state with consistent dimensions
        <div className="flex items-center gap-3 animate-pulse">
          <Avatar className="h-8 w-8">
            <AvatarFallback>
              <Image
                src="/avatar.png"
                alt="Loading"
                width={38}
                height={38}
                className="w-full h-full object-cover opacity-50"
              />
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <div className="h-4 bg-gray-200 rounded w-24 mb-1"></div>
            <div className="h-3 bg-gray-100 rounded w-8"></div>
          </div>
        </div>
      ) : user ? (
        // Authenticated state
        <Link href="/settings" className="w-full">
          <div className="flex items-center gap-3 hover:bg-popover-main hover:text-popover-text dark:hover:bg-hover/60 rounded-lg p-2 -m-2 cursor-pointer transition-colors">
            <Avatar className="h-8 w-8">
              <AvatarImage
                src={user?.profilePictureUrl || "/avatar.png"}
                alt={user?.firstName || "User"}
              />
              <AvatarFallback>
                <Image
                  src="/avatar.png"
                  alt="Default avatar"
                  width={38}
                  height={38}
                  className="w-full h-full object-cover"
                />
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">
                {user?.firstName && user?.lastName
                  ? `${user.firstName} ${user.lastName}`
                  : user?.firstName || "User"}
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
