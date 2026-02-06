"use client";

import { useCustomer, useEntity } from "autumn-js/react";
import { useAuth } from "@/components/auth/auth-context";
import { useOrgContext } from "@/contexts/org-context";
import {
  type QuotaInfo,
  type AutumnFeature,
  mapAutumnToQuotaInfo,
  UNCONFIGURED_QUOTA_INFO,
} from "@/lib/autumn-quota";
import { PLANS_WITH_SEATS } from "@/lib/plan-ids";
import { Progress } from "@/components/ai/ui/progress";
import { Skeleton } from "@/components/ai/ui/skeleton";

export type { QuotaInfo } from "@/lib/autumn-quota";

function useAutumnQuotaInfo(): { quotaInfo: QuotaInfo | undefined; isLoading: boolean } {
  const { orgInfo, isLoading: orgLoading } = useOrgContext();
  const { user } = useAuth();
  const plan = orgInfo?.plan ?? null;
  const usePerSeatEntity = plan != null && PLANS_WITH_SEATS.has(plan);

  const { customer, isLoading: customerLoading } = useCustomer();
  const entityId = usePerSeatEntity && user?.id ? user.id : null;
  const { entity: entityData, isLoading: entityLoading } = useEntity(entityId);

  const loading =
    orgLoading ||
    (usePerSeatEntity && !user?.id) ||
    (usePerSeatEntity ? entityLoading : customerLoading);

  if (loading) {
    return { quotaInfo: undefined, isLoading: true };
  }

  if (usePerSeatEntity && entityData) {
    const features = entityData.features as Record<string, AutumnFeature> | undefined;
    return { quotaInfo: mapAutumnToQuotaInfo(features), isLoading: false };
  }

  if (customer) {
    const features = customer.features as Record<string, AutumnFeature> | undefined;
    return { quotaInfo: mapAutumnToQuotaInfo(features), isLoading: false };
  }

  return { quotaInfo: UNCONFIGURED_QUOTA_INFO, isLoading: false };
}

export function QuotaUsageNumbers({
  type,
  quotaInfo: propQuotaInfo,
}: {
  type: "standard" | "premium";
  quotaInfo?: QuotaInfo;
}) {
  const { quotaInfo: autumnQuota, isLoading } = useAutumnQuotaInfo();
  const quotaInfo = propQuotaInfo ?? autumnQuota;

  if (isLoading || quotaInfo === undefined) {
    return <QuotaUsageSkeleton />;
  }

  const data = quotaInfo[type];
  const { currentUsage, limit, quotaConfigured } = data;
  
  if (!quotaConfigured) {
    return (
      <p className="text-sm text-gray-500 dark:text-text-muted">
        No tienes una suscripción activa
      </p>
    );
  }

  const isUnlimited = limit === 0;
  
  if (isUnlimited) {
    return (
      <p className="text-2xl font-bold text-green-600 dark:text-green-400">
        Ilimitado
      </p>
    );
  }

  return (
    <p className="text-2xl font-bold text-gray-900 dark:text-white">
      {currentUsage}/{limit} usado
    </p>
  );
}

export function QuotaRemaining({
  type,
  quotaInfo: propQuotaInfo,
}: {
  type: "standard" | "premium";
  quotaInfo?: QuotaInfo;
}) {
  const { quotaInfo: autumnQuota, isLoading } = useAutumnQuotaInfo();
  const quotaInfo = propQuotaInfo ?? autumnQuota;

  if (isLoading || quotaInfo === undefined) {
    return <QuotaRemainingSkeleton />;
  }

  const data = quotaInfo[type];
  const { currentUsage, limit, quotaConfigured } = data;
  
  if (!quotaConfigured) {
    return null;
  }

  const isUnlimited = limit === 0;
  const remaining = isUnlimited ? "Ilimitado" : limit - currentUsage;

  return (
    <p className="text-sm font-medium text-gray-500 dark:text-text-muted">
      {remaining} mensajes restantes
    </p>
  );
}

export function QuotaProgress({
  type,
  quotaInfo: propQuotaInfo,
}: {
  type: "standard" | "premium";
  quotaInfo?: QuotaInfo;
}) {
  const { quotaInfo: autumnQuota, isLoading } = useAutumnQuotaInfo();
  const quotaInfo = propQuotaInfo ?? autumnQuota;

  if (isLoading || quotaInfo === undefined) {
    return <QuotaProgressSkeleton />;
  }

  const data = quotaInfo[type];
  const { currentUsage, limit, quotaConfigured } = data;
  
  if (!quotaConfigured) {
    return null;
  }

  const percentage = limit > 0 ? Math.min((currentUsage / limit) * 100, 100) : 0;
  const isUnlimited = limit === 0;

  if (isUnlimited) {
    return (
      <div className="w-full h-2 bg-green-200 dark:bg-green-800 rounded-full">
        <div className="h-2 bg-green-500 dark:bg-green-400 rounded-full w-full"></div>
      </div>
    );
  }

  return (
    <>
      <Progress value={percentage} className="w-full h-2 [&>div]:bg-accent" />
      <p className="text-xs text-gray-500 dark:text-text-muted">
        {percentage.toFixed(0)}% utilizado
      </p>
    </>
  );
}

export function ResetDateText({
  quotaInfo: propQuotaInfo,
}: {
  quotaInfo?: QuotaInfo;
} = {}) {
  const { quotaInfo: autumnQuota, isLoading } = useAutumnQuotaInfo();
  const quotaInfo = propQuotaInfo ?? autumnQuota;

  if (isLoading || quotaInfo === undefined) {
    return <ResetDateSkeleton />;
  }

  const info = quotaInfo;

  const formatDate = (timestamp: number | undefined) => {
    if (!timestamp) return "No disponible";
    const date = new Date(timestamp);
    return date.toLocaleDateString('es-MX', { 
      day: 'numeric', 
      month: 'long', 
      year: 'numeric' 
    });
  };

  return (
    <p className="text-gray-500 dark:text-text-muted text-sm leading-5 mt-1">
      {formatDate(info?.nextResetDate)}
    </p>
  );
}


export function QuotaUsageSkeleton() {
  return <Skeleton className="h-9 w-32" />;
}

export function QuotaRemainingSkeleton() {
  return <Skeleton className="h-5 w-40" />;
}

export function QuotaProgressSkeleton() {
  return (
    <div className="space-y-2">
      <Skeleton className="h-2 w-full" />
      <Skeleton className="h-3 w-16" />
    </div>
  );
}

export function ResetDateSkeleton() {
  return <Skeleton className="h-5 w-48 mt-1" />;
}
