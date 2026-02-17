"use client";

import { useCallback } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Skeleton } from "@/components/ai/ui/skeleton";

const toggleSkeleton = (
  <div className="flex items-center">
    <Skeleton className="w-11 h-6 rounded-full" />
  </div>
);

export function MemoriaSettings() {
  const config = useQuery(api.userConfiguration.getUserConfiguration, {});
  const updatePreference = useMutation(api.userConfiguration.updateSupermemoryPreference)
    .withOptimisticUpdate((localStore, args) => {
      const { enabled } = args;
      const currentConfig = localStore.getQuery(api.userConfiguration.getUserConfiguration, {});
      if (currentConfig !== undefined && currentConfig !== null) {
        // Update the query result optimistically (preserve onboardingCompleted)
        localStore.setQuery(
          api.userConfiguration.getUserConfiguration,
          {},
          { ...currentConfig, supermemoryEnabled: enabled }
        );
      }
    });

  const handleToggle = useCallback((enabled: boolean) => {
    updatePreference({ enabled }).catch((err) => {
      console.error("Failed to update supermemory preference:", err);
    });
  }, [updatePreference]);

  if (config === undefined) {
    return toggleSkeleton;
  }

  if (config === null) {
    return (
      <div className="flex items-center">
        <p className="text-sm text-gray-500 dark:text-text-muted">
          No disponible
        </p>
      </div>
    );
  }

  return (
    <div className="flex items-center">
      <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
        <input
          type="checkbox"
          className="sr-only peer"
          checked={config.supermemoryEnabled}
          onChange={(e) => handleToggle(e.target.checked)}
        />
        <div className="w-11 h-6 bg-gray-200 dark:bg-gray-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-600 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 dark:after:border-gray-600 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600 dark:peer-checked:bg-blue-500"></div>
      </label>
    </div>
  );
}
