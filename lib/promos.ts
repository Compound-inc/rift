/**
 * Active landing/sign-up promos. Used to show custom pricing UI and pass
 * Autumn reward IDs to checkout when the user arrives from specific UTM sources.
 */

export type PlanSlug = "plus" | "pro";

export type PromoLabelKey = "firstMonthFree" | "firstMonthPercentOff";

export type PromoPlanOffer = {
  /** Autumn reward ID to apply at checkout (e.g. "just_use_ai") */
  rewardId: string;
  /** Translation key for the badge; use getPromoLabel() with dict to resolve. */
  labelKey: PromoLabelKey;
  /** For firstMonthPercentOff, the discount percent (e.g. 50). */
  percent?: number;
};

export type LandingPromo = {
  id: string;
  /** UTM source that must match (e.g. "linkedin") */
  utmSource: string;
  /** UTM campaign that must match (e.g. "just-use-ai") */
  utmCampaign: string;
  /** Offers per plan; only plus and pro are supported for checkout rewards */
  plans: {
    plus?: PromoPlanOffer;
    pro?: PromoPlanOffer;
  };
};

const PROMO_STORAGE_KEY = "rift_landing_promo_reward";
const PROMO_COOKIE_NAME = "rift_promo";
const PROMO_COOKIE_MAX_AGE_DAYS = 30;

/**
 * Persist the active promo ID (e.g. "just_use_ai") in sessionStorage and cookie.
 * Resolve to a plan-specific reward_id when starting checkout (one reward per plan
 * to avoid Stripe "maximum 1 discount" error).
 */
export function setStoredPromoReward(promoId: string | null): void {
  if (typeof window === "undefined") return;
  if (promoId) {
    window.sessionStorage.setItem(PROMO_STORAGE_KEY, promoId);
    const maxAge = PROMO_COOKIE_MAX_AGE_DAYS * 24 * 60 * 60;
    document.cookie = `${PROMO_COOKIE_NAME}=${encodeURIComponent(promoId)}; path=/; max-age=${maxAge}; SameSite=Lax`;
  } else {
    window.sessionStorage.removeItem(PROMO_STORAGE_KEY);
    document.cookie = `${PROMO_COOKIE_NAME}=; path=/; max-age=0`;
  }
}

/**
 * Read stored promo ID from cookie (then sessionStorage). Used on /subscribe and
 * to restore promo for returning visitors.
 */
export function getStoredPromoReward(): string | null {
  if (typeof window === "undefined") return null;
  const fromCookie = getPromoFromCookie();
  if (fromCookie) return fromCookie;
  return window.sessionStorage.getItem(PROMO_STORAGE_KEY);
}

function getPromoFromCookie(): string | null {
  if (typeof document === "undefined" || !document.cookie) return null;
  const match = document.cookie.match(
    new RegExp(`(?:^|;\\s*)${PROMO_COOKIE_NAME}=([^;]*)`),
  );
  if (!match) return null;
  try {
    return decodeURIComponent(match[1].trim());
  } catch {
    return null;
  }
}

/**
 * Get promo by id (e.g. from cookie) so returning visitors can see the same promo.
 */
export function getActivePromoById(promoId: string | null): LandingPromo | null {
  if (!promoId?.trim()) return null;
  return ACTIVE_LANDING_PROMOS.find((p) => p.id === promoId.trim()) ?? null;
}

/** All active promos. */
export const ACTIVE_LANDING_PROMOS: LandingPromo[] = [
  {
    id: "just_use_ai",
    utmSource: "linkedin",
    utmCampaign: "just-use-ai",
    plans: {
      plus: {
        rewardId: "just_use_ai",
        labelKey: "firstMonthFree",
      },
      pro: {
        rewardId: "just_use_ai_pro",
        labelKey: "firstMonthPercentOff",
        percent: 50,
      },
    },
  },
  {
    id: "passwork",
    utmSource: "social",
    utmCampaign: "passwork",
    plans: {
      plus: {
        rewardId: "passwork",
        labelKey: "firstMonthFree",
      },
      pro: {
        rewardId: "passwork_pro",
        labelKey: "firstMonthPercentOff",
        percent: 50,
      },
    },
  },
];

export type PromoLabelDict = {
  promoFirstMonthFree: string;
  promoFirstMonthPercentOff: string;
};

/**
 * Resolve translated promo label from dictionary. Use in pricing section.
 */
export function getPromoLabel(
  offer: PromoPlanOffer,
  dict: PromoLabelDict,
): string {
  if (offer.labelKey === "firstMonthFree") {
    return dict.promoFirstMonthFree;
  }
  const template = dict.promoFirstMonthPercentOff;
  const percent = offer.percent ?? 0;
  return template.replace(/\{percent\}/g, String(percent));
}

/**
 * Find the first active promo whose UTM params match. Normalizes source/campaign to lowercase.
 * Campaign is required; if only utm_campaign is present, matches by campaign alone.
 */
export function getActivePromoForUtm(
  utmSource: string | null,
  utmCampaign: string | null,
): LandingPromo | null {
  if (!utmCampaign?.trim()) return null;
  const campaign = utmCampaign.toLowerCase().trim();
  const source = utmSource?.toLowerCase().trim() ?? null;

  return (
    ACTIVE_LANDING_PROMOS.find((p) => {
      if (p.utmCampaign.toLowerCase() !== campaign) return false;
      if (source === null) return true;
      return p.utmSource.toLowerCase() === source;
    }) ?? null
  );
}

/**
 * Get the reward ID to send to Autumn for a given plan under this promo.
 * Uses the plan-specific rewardId (same for both plans in just_use_ai).
 */
export function getRewardIdForPlan(promo: LandingPromo, plan: PlanSlug): string | null {
  const offer = promo.plans[plan];
  return offer?.rewardId ?? null;
}
