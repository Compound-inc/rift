"use client";

import { useSearchParams } from "next/navigation";
import { useMemo, useEffect } from "react";
import {
  getActivePromoForUtm,
  getActivePromoById,
  getStoredPromoReward,
  setStoredPromoReward,
  type LandingPromo,
} from "@/lib/promos";

/**
 * Reads UTM params from the URL, matches against active promos, persists reward to
 * cookie + sessionStorage, and returns the active promo. When the user returns
 * without UTM, restores promo from cookie so the same offer is still shown.
 */
export function useLandingPromo(): LandingPromo | null {
  const searchParams = useSearchParams();

  const utmSource = searchParams.get("utm_source");
  const utmCampaign = searchParams.get("utm_campaign");

  const activePromo = useMemo(() => {
    const fromUtm = getActivePromoForUtm(utmSource, utmCampaign);
    if (fromUtm) return fromUtm;
    const stored = getStoredPromoReward();
    return getActivePromoById(stored);
  }, [utmSource, utmCampaign]);

  useEffect(() => {
    if (activePromo) {
      setStoredPromoReward(activePromo.id);
    }
  }, [activePromo]);

  return activePromo ?? null;
}
