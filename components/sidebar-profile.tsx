import { api } from "@/convex/_generated/api";
import { Avatar, AvatarImage } from "./ui/avatar";
import { Skeleton } from "./ui/skeleton";
import { useAuth } from "@workos-inc/authkit-nextjs/components";
import { useMutation, useQuery } from "convex/react";
import { Authenticated } from "convex/react";

export default function SidebarProfile() {
  const { user } = useAuth();

  return (
    <button className="border-t">
      <div className="hover:bg-sidebar-border-light mb-2 flex cursor-pointer items-center gap-3 rounded-lg px-3 py-3">
        {user ? (
          <Avatar className="h-8 w-8">
            <AvatarImage src={user.profilePictureUrl || "/avatar.png"} />
          </Avatar>
        ) : (
          <Skeleton className="h-8 w-8 rounded-full" />
        )}

        <div className="flex flex-col items-start justify-center">
          <h4 className="text-sidebar-logo text-sm font-semibold">
            {user ? (
              `${user.firstName}`
            ) : (
              <Skeleton className="h-5 w-32" />
            )}
          </h4>
          <span className="text-sidebar-text-muted text-xs">Free</span>
        </div>
      </div>
    </button>
  );
}
