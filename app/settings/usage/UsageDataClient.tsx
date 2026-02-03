"use client";

import { useCustomer, useEntity } from "autumn-js/react";
import { useAuth } from "@/components/auth/auth-context";
import { useOrgContext } from "@/contexts/org-context";
import {
  type AutumnFeature,
  mapAutumnToQuotaInfo,
} from "@/lib/autumn-quota";
import { QuotaCard } from "./QuotaCard";
import { UsageSkeleton } from "./UsageSkeleton";

const dataError = (
  <div className="p-6 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-900/50">
    <p className="text-sm text-red-700 dark:text-red-400">
      No se pudo cargar la información de cuotas. Por favor intenta más tarde.
    </p>
  </div>
);

export function UsageDataClient() {
  const { orgInfo, isLoading: orgLoading } = useOrgContext();
  const { user } = useAuth();
  const plan = orgInfo?.plan ?? null;
  const isEnterprise = plan === "enterprise";

  const { customer, isLoading: customerLoading } = useCustomer();
  const entityId = isEnterprise && user?.id ? user.id : null;
  const { entity: entityData, isLoading: entityLoading } = useEntity(entityId);

  const loading =
    orgLoading ||
    (isEnterprise && !user?.id) ||
    (isEnterprise ? entityLoading : customerLoading);

  if (loading) {
    return <UsageSkeleton />;
  }

  if (isEnterprise) {
    const features = entityData?.features as Record<string, AutumnFeature> | undefined;
    const info = mapAutumnToQuotaInfo(features);
    return (
      <>
        <div className="grid gap-6 md:grid-cols-2">
          <QuotaCard type="standard" data={info.standard} />
          <QuotaCard type="premium" data={info.premium} />
        </div>
        <QuotaCard type="reset" nextResetDate={info.nextResetDate} />
      </>
    );
  }

  if (!customer) {
    return dataError;
  }

  const features = customer.features as Record<string, AutumnFeature> | undefined;
  const info = mapAutumnToQuotaInfo(features);

  return (
    <>
      <div className="grid gap-6 md:grid-cols-2">
        <QuotaCard type="standard" data={info.standard} />
        <QuotaCard type="premium" data={info.premium} />
      </div>
      <QuotaCard type="reset" nextResetDate={info.nextResetDate} />
    </>
  );
}
