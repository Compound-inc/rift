"use client";

import { useConvexAuth, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ai/ui/button";
import { Badge } from "@/components/ui/badge";
import { useRouter } from "next/navigation";

import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";
import { useIsClient } from "@/lib/hooks/useIsClient";
import {
  getLastUserKey,
  loadSidebarProfile,
  saveSidebarProfile,
  setLastUserKey,
  type SidebarProfile,
} from "@/lib/local-first/sidebar-cache";
import { ProfileSkeleton } from "./user-profile-section";

interface UserProfileSectionClientProps {
  serverSkeleton?: React.ReactNode;
}

function getBasePlan(plan: string): string {
  return plan.replace(/_api$/i, "");
}

function capitalizePlan(plan: string): string {
  const basePlan = getBasePlan(plan);
  return basePlan.charAt(0).toUpperCase() + basePlan.slice(1);
}

function getPlanBadgeStyles(plan: string) {
  const basePlan = getBasePlan(plan);
  switch (basePlan) {
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

export function UserProfileSectionClient({
  serverSkeleton,
}: UserProfileSectionClientProps) {
  const router = useRouter();
  const { isAuthenticated, isLoading } = useConvexAuth();
  const user = useQuery(
    api.users.getCurrentUser,
    isAuthenticated ? {} : "skip",
  );
  const orgInfo = useQuery(
    api.organizations.getCurrentOrganizationInfo,
    isAuthenticated ? {} : "skip",
  );

  const isClient = useIsClient();
  const [initialUserKey] = useState<string | null>(() => getLastUserKey());
  const userKey = user?.workos_id ?? initialUserKey;
  const [cachedProfile, setCachedProfile] = useState<SidebarProfile | null>(
    null,
  );
  const [cacheLoaded, setCacheLoaded] = useState(false);

  useEffect(() => {
    if (user?.workos_id) {
      setLastUserKey(user.workos_id);
    }
  }, [user?.workos_id]);

  useEffect(() => {
    if (!userKey) return;
    let cancelled = false;
    void (async () => {
      // Move state updates into the async task (avoids setState directly in effect body).
      setCacheLoaded(false);
      setCachedProfile(null);
      const cached = await loadSidebarProfile(userKey);
      if (cancelled) return;
      setCachedProfile(cached);
      setCacheLoaded(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [userKey]);

  useEffect(() => {
    if (!userKey) return;
    if (!user) return;
    const displayName =
      user.firstName && user.lastName
        ? `${user.firstName} ${user.lastName}`
        : user.firstName || "User";
    void saveSidebarProfile(userKey, {
      displayName,
      profilePictureUrl: user.profilePictureUrl,
      plan: orgInfo?.plan ?? undefined,
    });
  }, [userKey, user, orgInfo?.plan]);

  const optimisticDisplayName = cachedProfile?.displayName;
  const optimisticAvatarUrl = cachedProfile?.profilePictureUrl;
  const optimisticPlan = cachedProfile?.plan;
  const canShowOptimistic = cacheLoaded && Boolean(optimisticDisplayName);
  const isLoadingIndexedDB = userKey && !cacheLoaded;
  const shouldShowSkeleton =
    (isLoading && !canShowOptimistic) || isLoadingIndexedDB;

  // Show skeleton during SSR and initial load
  // On server and initial client render, show skeleton to match SSR
  if (!isClient) {
    return <>{serverSkeleton || <ProfileSkeleton />}</>;
  }

  // After mount, show skeleton if still loading
  if (shouldShowSkeleton) {
    return <ProfileSkeleton />;
  }

  if (user || canShowOptimistic) {
    // Authenticated state
    return (
      <Link href="/settings/usage?sidebar=true" className="w-full">
        <div className="group flex items-center gap-3 hover:bg-popover-main hover:text-popover-text dark:hover:bg-hover/60 rounded-lg p-2 -m-2 cursor-pointer transition-colors">
          <div className="h-8 w-8 rounded-full overflow-hidden bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-700 dark:to-gray-800 flex-shrink-0">
            {user?.profilePictureUrl || optimisticAvatarUrl ? (
              <Image
                src={(user?.profilePictureUrl || optimisticAvatarUrl) as string}
                alt={
                  (user?.firstName || optimisticDisplayName || "User") as string
                }
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
                {user?.firstName && user?.lastName
                  ? `${user.firstName} ${user.lastName}`
                  : user?.firstName || optimisticDisplayName || "User"}
              </p>
              {(orgInfo?.plan || optimisticPlan) && (
                <Badge
                  variant="outline"
                  className={cn(
                    "h-5 px-2 text-[10px] font-medium capitalize rounded-full shadow-none",
                    getPlanBadgeStyles(
                      (orgInfo?.plan || optimisticPlan) as string,
                    ),
                  )}
                >
                  {capitalizePlan((orgInfo?.plan || optimisticPlan) as string)}
                </Badge>
              )}
            </div>
          </div>
        </div>
      </Link>
    );
  }

  // Unauthenticated state
  const handleSignInHover = () => {
    router.prefetch("/sign-in");
  };

  return (
    <Link href="/sign-in" onMouseEnter={handleSignInHover} className="w-full">
      <Button className="w-full bg-accent hover:bg-accent/90 text-white rounded-lg font-medium">
        Iniciar sesión
      </Button>
    </Link>
  );
}
