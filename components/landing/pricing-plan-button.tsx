'use client';

import { useCustomer } from "autumn-js/react";
import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ai/ui/button";
import CheckoutDialog from "@/components/autumn/checkout-dialog";
import type { LandingPlan } from "@/components/landing/data/pricing";
import { PlanSlug, PricingContext, SubscriptionPlan } from "@/lib/pricing-context";
import { usePricingContext } from "@/lib/use-pricing-context";
import { getAutumnBillingPortalUrl } from "@/actions/getAutumnBillingPortalUrl";

const CTA_BUTTON_CLASS =
  "hover:bg-white hover:text-[color(display-p3_0.1725490196_0.1764705882_0.1882352941/1)] hover:shadow-[rgba(0,0,0,0.1)_0px_0px_0px_1px] relative flex w-full cursor-pointer select-none items-center justify-center whitespace-nowrap bg-white text-sm leading-4 tracking-normal duration-[0.17s] text-[color(display-p3_0.1725490196_0.1764705882_0.1882352941/1)] dark:bg-zinc-900 dark:text-white dark:hover:bg-zinc-800 shadow-[rgba(0,0,0,0.05)_0px_0px_0px_1px] rounded-[50px] h-10 border-none disabled:opacity-50 disabled:cursor-not-allowed";

type PlanButtonConfig = {
  label: string;
  href?: string;
  external?: boolean;
  disabled: boolean;
  openBillingPortal?: boolean;
};

type PricingButtonLabels = {
  loading: string;
  subscribe: string;
  activeSubscription: string;
  manage: string;
  active: string;
  changeToPro: string;
  changeToPlan: string;
};

const DEFAULT_BUTTON_LABELS: PricingButtonLabels = {
  loading: "Suscribirse",
  subscribe: "Suscribirse",
  activeSubscription: "Suscripción activa",
  manage: "Administrar",
  active: "Activa",
  changeToPro: "Cambiar a Pro",
  changeToPlan: "Cambiar a {planName}",
};

type PricingPlanButtonProps = {
  plan: LandingPlan;
  slug: PlanSlug;
  buttonLabels?: Partial<PricingButtonLabels>;
};

const PAID_PLAN_SLUGS = new Set<PlanSlug>(["plus", "pro"]);

export function PricingPlanButton({ plan, slug, buttonLabels }: PricingPlanButtonProps) {
  const [isCheckoutLoading, setIsCheckoutLoading] = useState(false);
  const [isPortalLoading, setIsPortalLoading] = useState(false);
  const { checkout } = useCustomer();
  const resolvedContext = usePricingContext();
  const canManageBilling = resolvedContext.canManageBilling;
  const labels = { ...DEFAULT_BUTTON_LABELS, ...buttonLabels };

  const cta = buildPlanCta(slug, plan, resolvedContext, labels);

  let linkHref: string | null =
    !cta.disabled && typeof cta.href === "string" ? cta.href : null;

  if (cta.openBillingPortal && !canManageBilling) {
    linkHref = null;
  }

  const isUpgradeFlow =
    Boolean(linkHref) &&
    !cta.external &&
    resolvedContext.hasActiveSubscription &&
    resolvedContext.canManageBilling &&
    PAID_PLAN_SLUGS.has(slug) &&
    slug !== resolvedContext.activePlan;

  if (resolvedContext.isLoading) {
    return (
      <div className="flex w-full flex-col gap-3">
        <Button className={CTA_BUTTON_CLASS} disabled aria-busy="true" aria-live="polite">
          {labels.loading}
        </Button>
      </div>
    );
  }

  const isManageBillingFlow = Boolean(
    linkHref && cta.openBillingPortal && canManageBilling,
  );

  if (!linkHref && !isManageBillingFlow) {
    return (
      <div className="flex w-full flex-col gap-3">
        <Button className={CTA_BUTTON_CLASS} disabled>
          {cta.label}
        </Button>
      </div>
    );
  }

  const handleOpenBillingPortal = async () => {
    if (isPortalLoading || !canManageBilling) return;
    setIsPortalLoading(true);
    try {
      const returnUrl = typeof window !== "undefined" ? window.location.href : undefined;
      const result = await getAutumnBillingPortalUrl(returnUrl);
      if ("url" in result && result.url) {
        window.location.href = result.url;
      }
    } catch (error) {
      console.error("Failed to open billing portal:", error);
    } finally {
      setIsPortalLoading(false);
    }
  };

  const handleUpgradeClick = async () => {
    if (!linkHref || isCheckoutLoading) return;
    setIsCheckoutLoading(true);
    try {
      const { data, error } = await checkout({
        productId: slug,
        dialog: CheckoutDialog,
      });
      if (error) {
        console.error("Checkout error:", error);
        return;
      }
      if (data?.url) {
        window.location.href = data.url;
      }
    } finally {
      setIsCheckoutLoading(false);
    }
  };

  return (
    <div className="flex w-full flex-col gap-3">
      {isManageBillingFlow ? (
        <Button
          className={CTA_BUTTON_CLASS}
          onClick={handleOpenBillingPortal}
          disabled={isPortalLoading}
          aria-busy={isPortalLoading}
        >
          {cta.label}
        </Button>
      ) : isUpgradeFlow ? (
        <Button
          className={CTA_BUTTON_CLASS}
          onClick={handleUpgradeClick}
          disabled={isCheckoutLoading}
          aria-busy={isCheckoutLoading}
        >
          {cta.label}
        </Button>
      ) : (
        <Button className={CTA_BUTTON_CLASS} asChild>
          {cta.external ? (
            <a href={linkHref!}>{cta.label}</a>
          ) : (
            <Link href={linkHref!}>{cta.label}</Link>
          )}
        </Button>
      )}
    </div>
  );
}

function buildPlanCta(
  slug: PlanSlug,
  plan: LandingPlan,
  context: PricingContext,
  labels: PricingButtonLabels,
): PlanButtonConfig {
  const defaultHref = getDefaultPlanHref(slug, context.isAuthenticated, plan);
  const isEnterprisePlan = slug === "enterprise";

  if (!context.hasActiveSubscription) {
    if (
      context.isAuthenticated &&
      context.currentPlan === "free" &&
      !context.canManageBilling
    ) {
      return {
        label: labels.subscribe,
        disabled: true,
      };
    }

    return {
      label: plan.buttonText,
      href: defaultHref,
      external: isEnterprisePlan,
      disabled: false,
    };
  }

  if (!context.activePlan) {
    return {
      label: labels.activeSubscription,
      disabled: true,
    };
  }

  const isSamePlan = slug === context.activePlan;
  const userRank = getPlanRank(context.activePlan);
  const targetRank = getPlanRank(slug);

  if (isSamePlan) {
    if (context.canManageBilling) {
      return {
        label: labels.manage,
        href: "/settings/billing",
        external: false,
        disabled: false,
        openBillingPortal: true,
      };
    }

    return {
      label: labels.active,
      disabled: true,
    };
  }

  if (targetRank < userRank) {
    return {
      label: labels.subscribe,
      disabled: true,
    };
  }

  if (isEnterprisePlan) {
    return {
      label: plan.buttonText,
      href: defaultHref,
      external: true,
      disabled: false,
    };
  }

  const upgradeLabel =
    slug === "pro" && context.activePlan === "plus"
      ? labels.changeToPro
      : labels.changeToPlan.replace("{planName}", plan.name);

  if (!context.canManageBilling) {
    return {
      label: upgradeLabel,
      disabled: true,
    };
  }

  return {
    label: upgradeLabel,
    href: defaultHref,
    external: false,
    disabled: false,
  };
}

function getDefaultPlanHref(
  slug: PlanSlug,
  isAuthenticated: boolean,
  plan: LandingPlan,
): string {
  if (slug === "enterprise") {
    return plan.href;
  }

  const basePath = isAuthenticated ? "/subscribe" : "/sign-up";
  return `${basePath}?plan=${slug}`;
}

function getPlanRank(plan: SubscriptionPlan | null): number {
  if (!plan) return 0;
  const PLAN_ORDER: SubscriptionPlan[] = ["free", "plus", "pro", "enterprise"];
  const rank = PLAN_ORDER.indexOf(plan);
  return rank === -1 ? 0 : rank;
}

