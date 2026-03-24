"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useCustomer, useEntity } from "autumn-js/react";
import { useAuth } from "@/components/auth/auth-context";
import { useOrgContext } from "@/contexts/org-context";
import {
  type AutumnFeature,
  mapAutumnToQuotaInfo,
} from "@/lib/autumn-quota";
import { PLANS_WITH_SEATS } from "@/lib/plan-ids";
import { ensureSeatEntity } from "@/actions/ensureSeatEntity";
import { QuotaCard } from "./QuotaCard";
import { UsageSkeleton } from "./UsageSkeleton";

const dataError = (
  <div className="p-6 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-900/50">
    <p className="text-sm text-red-700 dark:text-red-400">
      No se pudo cargar la información de cuotas. Por favor intenta más tarde.
    </p>
  </div>
);

const seatLimitError = (
  <div className="p-6 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-900/50">
    <p className="text-sm text-red-700 dark:text-red-400">
      Tu organización ha alcanzado el límite de usuarios permitidos.
    </p>
  </div>
);

function isEntityNotFoundError(error: { message?: string } | null | undefined): boolean {
  if (!error?.message) return false;
  const m = error.message;
  return m.includes("not found") && (m.includes("Entity") || m.includes("entity"));
}

export function UsageDataClient() {
  const { orgInfo, isLoading: orgLoading } = useOrgContext();
  const { user } = useAuth();
  const plan = orgInfo?.plan ?? null;
  const usePerSeatEntity = plan != null && PLANS_WITH_SEATS.has(plan);

  const { customer, isLoading: customerLoading } = useCustomer();
  const entityId = usePerSeatEntity && user?.id ? user.id : null;
  const { entity: entityData, isLoading: entityLoading, error: entityError, refetch: entityRefetch } = useEntity(entityId);

  const [ensureInProgress, setEnsureInProgress] = useState(false);
  const [seatLimitReached, setSeatLimitReached] = useState(false);
  const [ensureFailed, setEnsureFailed] = useState(false);
  const ensureTriggeredRef = useRef(false);

  const runEnsure = useCallback(async () => {
    if (ensureTriggeredRef.current) return;
    ensureTriggeredRef.current = true;
    setEnsureInProgress(true);
    setSeatLimitReached(false);
    setEnsureFailed(false);
    const result = await ensureSeatEntity();
    setEnsureInProgress(false);
    if (result.ok) {
      entityRefetch();
      return;
    }
    if (result.reason === "seat_limit") {
      setSeatLimitReached(true);
      return;
    }
    setEnsureFailed(true);
  }, [entityRefetch]);

  const hasEntityNotFoundError = entityError != null && isEntityNotFoundError(entityError);
  const noEntityDataAfterLoad = !entityLoading && entityData == null && entityId != null;
  const shouldEnsureEntity = hasEntityNotFoundError || noEntityDataAfterLoad;

  useEffect(() => {
    if (!usePerSeatEntity || !entityId) return;
    if (ensureInProgress || seatLimitReached || ensureFailed) return;
    if (shouldEnsureEntity) {
      runEnsure();
    }
  }, [usePerSeatEntity, entityId, ensureInProgress, seatLimitReached, ensureFailed, shouldEnsureEntity, runEnsure]);

  const loading =
    orgLoading ||
    (usePerSeatEntity && !user?.id) ||
    (usePerSeatEntity ? entityLoading || ensureInProgress : customerLoading);

  if (loading) {
    return <UsageSkeleton />;
  }

  if (usePerSeatEntity) {
    if (seatLimitReached) {
      return seatLimitError;
    }
    if (ensureFailed) {
      return dataError;
    }
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
