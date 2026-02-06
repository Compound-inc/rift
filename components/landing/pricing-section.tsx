import { landingPlans } from "@/components/landing/data/pricing";
import type { PlanSlug as PricingContextPlanSlug } from "@/lib/pricing-context";
import { PricingPlanButton } from "@/components/landing/pricing-plan-button";
import {
  StandarIcon,
  PremiumIcon,
  AIModelsIcon,
  SoporteIcon,
  ExpandIcon,
  SSOIcon,
  LogsIcon,
} from "@/components/ui/icons/landing-icons";
import { Scim, RedoIcon } from "@/components/ui/icons/svg-icons";
import { Check, ShieldCheck } from "lucide-react";
import type { Dictionary, PlanSlug } from "@/types/dictionary";

const priceFormatters: Record<string, Intl.NumberFormat> = {};

function formatPrice(amount: number, currency: string, locale: string) {
  const localeTag = locale === "es" ? "es-MX" : "en-US";
  const key = `${currency}-${localeTag}`;
  if (!priceFormatters[key]) {
    priceFormatters[key] = new Intl.NumberFormat(localeTag, {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    });
  }
  return priceFormatters[key].format(amount);
}

function getFeatureIcon(feature: string) {
  const lowerFeature = feature.toLowerCase();
  if (lowerFeature.includes("standard") || lowerFeature.includes("estándar")) return StandarIcon;
  if (lowerFeature.includes("premium")) return PremiumIcon;
  if (lowerFeature.includes("model") || lowerFeature.includes("modelo")) return AIModelsIcon;
  if (lowerFeature.includes("histor") || lowerFeature.includes("chat")) return RedoIcon;
  if (lowerFeature.includes("support") || lowerFeature.includes("soporte")) return SoporteIcon;
  if (lowerFeature.includes("limit") || lowerFeature.includes("límite")) return ExpandIcon;
  if (lowerFeature.includes("sso")) return SSOIcon;
  if (lowerFeature.includes("log") || lowerFeature.includes("audit")) return LogsIcon;
  if (lowerFeature.includes("scim") || lowerFeature.includes("seicm")) return Scim;
  if (lowerFeature.includes("sla")) return ShieldCheck;
  return Check;
}

type PricingSectionProps = {
  dict: Dictionary["pricing"];
  lang: string;
};

export default function PricingSection({ dict, lang }: PricingSectionProps) {
  return (
    <section
      className="flex w-full flex-col items-center scroll-mt-20 pt-24 md:pt-0"
      id="pricing"
      aria-labelledby="pricing-heading"
      aria-describedby="pricing-summary"
    >
      <div className="flex flex-col items-center justify-center space-y-4 text-center mb-12 md:mb-0">
        <h2
          id="pricing-heading"
          className="text-3xl font-bold tracking-tighter sm:text-4xl md:text-5xl text-[color(display-p3_0.1725490196_0.1764705882_0.1882352941/1)] dark:text-white"
        >
          {dict.heading}
        </h2>
        <p
          id="pricing-summary"
          className="max-w-[700px] text-[color(display-p3_0.1725490196_0.1764705882_0.1882352941/0.6)] dark:text-zinc-400 md:text-xl/relaxed lg:text-base/relaxed xl:text-xl/relaxed"
        >
          {dict.summary}
        </p>
      </div>

      <div className="max-md:px-4 max-md:py-4 max-lg:p-4 relative w-full lg:p-12 max-w-[1082px]">
        <div className="max-lg:top-3.5 absolute inset-x-0 top-12 flex w-full items-center justify-center">
          <svg width="100%" height="1" fill="none" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none" className="inline-block h-auto w-full will-change-transform max-w-[1082px]">
            <line x1="0" y1="0.5" x2="100%" y2="0.5" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" strokeOpacity="0.12" strokeDasharray="4 6" vectorEffect="non-scaling-stroke" className="stroke-[color(display-p3_0.1725490196_0.1764705882_0.1882352941/1)] dark:stroke-white" />
          </svg>
        </div>

        <div className="max-lg:left-3.5 absolute inset-y-0 left-12 flex h-full items-center justify-center">
          <svg width="1" height="100%" fill="none" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none" className="inline-block h-full max-w-full will-change-transform">
            <line x1="0.5" y1="0" x2="0.5" y2="100%" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" strokeOpacity="0.12" strokeDasharray="4 6" vectorEffect="non-scaling-stroke" className="stroke-[color(display-p3_0.1725490196_0.1764705882_0.1882352941/1)] dark:stroke-white" />
          </svg>
        </div>

        <div className="max-lg:h-auto max-lg:flex-col relative flex w-full items-stretch justify-center gap-8 lg:gap-0 overflow-hidden">
          {landingPlans.map((plan, index) => {
            const planSlug = plan.name.toLowerCase() as PlanSlug;
            const translated = dict.plans[planSlug];
            const description = translated?.description ?? plan.description;
            const features = translated?.features ?? plan.features;
            const buttonText = translated?.buttonText ?? plan.buttonText;
            const useUsd = lang === "en" && plan.usdPriceAmount != null;
            const amount = useUsd ? plan.usdPriceAmount! : plan.priceAmount;
            const currency = useUsd ? "USD" : plan.currency;
            const periodLabel = useUsd && plan.billingPeriodLabelEn ? plan.billingPeriodLabelEn : plan.billingPeriodLabel;
            const formattedPrice =
              amount !== null ? formatPrice(amount, currency, lang) : dict.customPrice;
            const period = periodLabel ? `/${periodLabel}` : "";
            const slugForContext = planSlug as PricingContextPlanSlug;

            return (
              <div key={plan.name} className="contents">
                {index > 0 && <VerticalDivider />}
                <article
                  aria-labelledby={`plan-${plan.name.toLowerCase()}-title`}
                  className="relative z-[2] flex w-full flex-col items-center gap-6 px-6 py-12"
                >
                  <GradientBackground id={plan.gradientId} />

                  {plan.popular && (
                    <div className="absolute top-4 px-3 py-1 bg-[color(display-p3_0.1725490196_0.1764705882_0.1882352941/1)] text-white dark:bg-white dark:text-black text-xs font-bold rounded-full uppercase tracking-wide">
                      {dict.mostPopular}
                    </div>
                  )}

                  <div className="flex flex-col items-center justify-center gap-2 text-center">
                    <h3 id={`plan-${plan.name.toLowerCase()}-title`} className="text-2xl font-medium leading-6 tracking-tight text-[color(display-p3_0.1725490196_0.1764705882_0.1882352941/1)] dark:text-white">
                      {plan.name}
                    </h3>
                    <div className="flex items-baseline justify-center text-[color(display-p3_0.1725490196_0.1764705882_0.1882352941/1)] dark:text-white">
                      <span className="text-4xl font-bold tracking-tight">
                        {formattedPrice}
                      </span>
                      {period && amount !== null && (
                        <span className="ml-1 text-sm font-medium opacity-60">
                          {period}
                        </span>
                      )}
                    </div>
                    <p className="text-sm leading-6 tracking-tight text-[color(display-p3_0.1725490196_0.1764705882_0.1882352941/0.6)] dark:text-zinc-400 max-w-[280px]">
                      {description}
                    </p>
                  </div>

                  <ul className="flex-1 space-y-4 w-full max-w-[280px]" aria-label={dict.featuresLabel.replace("{planName}", plan.name)}>
                    {features.map((feature) => {
                      const Icon = getFeatureIcon(feature);
                      return (
                        <li
                          key={feature}
                          className="flex items-center text-[color(display-p3_0.1725490196_0.1764705882_0.1882352941/0.8)] dark:text-zinc-300"
                        >
                          <div className="mr-3 shrink-0">
                            <Icon className="h-5 w-5 text-[color(display-p3_0.1725490196_0.1764705882_0.1882352941/1)] dark:text-white opacity-80" />
                          </div>
                          <span className="text-sm">{feature}</span>
                        </li>
                      );
                    })}
                  </ul>

                  <footer className="w-full max-w-[280px] mt-auto">
                    <PricingPlanButton
                      plan={{ ...plan, description, features, buttonText }}
                      slug={slugForContext}
                      buttonLabels={dict.button}
                    />
                  </footer>
                </article>
              </div>
            );
          })}
        </div>

        {/* Right border */}
        <div className="max-lg:top-0 max-lg:right-4 max-lg:bottom-auto max-lg:z-[11] absolute inset-y-0 right-12 flex h-full items-center justify-center">
          <svg width="1" height="100%" fill="none" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none" className="inline-block h-full max-w-full will-change-transform">
            <line x1="0.5" y1="0" x2="0.5" y2="100%" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" strokeOpacity="0.12" strokeDasharray="4 6" vectorEffect="non-scaling-stroke" className="stroke-[color(display-p3_0.1725490196_0.1764705882_0.1882352941/1)] dark:stroke-white" />
          </svg>
        </div>

        {/* Bottom border */}
        <div className="max-lg:bottom-3.5 absolute inset-x-0 bottom-12 flex w-full items-center justify-center">
          <svg width="100%" height="1" fill="none" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none" className="inline-block h-auto w-full will-change-transform max-w-[1082px]">
            <line x1="0" y1="0.5" x2="100%" y2="0.5" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" strokeOpacity="0.12" strokeDasharray="4 6" vectorEffect="non-scaling-stroke" className="stroke-[color(display-p3_0.1725490196_0.1764705882_0.1882352941/1)] dark:stroke-white" />
          </svg>
        </div>
      </div>
    </section>
  );
}

function GradientBackground({ id }: { id: string }) {
  const gradients = {
    "1": (
      <>
        <rect width="300" height="300" fill="url(#paint0_radial_262_665)" />
        <rect width="300" height="300" fill="url(#paint1_radial_262_665)" />
        <rect width="300" height="300" fill="url(#paint2_radial_262_665)" />
        <rect width="300" height="300" fill="url(#paint3_radial_262_665)" />
        <defs>
          <radialGradient id="paint0_radial_262_665" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(117 300) rotate(-90) scale(181)">
            <stop stopColor="#5767C2" stopOpacity="0.1" />
            <stop offset="1" stopColor="#5767C2" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="paint1_radial_262_665" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(199 79.5) rotate(-180) scale(142.5)">
            <stop stopColor="#FF6D2E" stopOpacity="0.07" />
            <stop offset="1" stopColor="#FF6D2E" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="paint2_radial_262_665" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(331 243.5) rotate(-180) scale(208)">
            <stop stopColor="#2CC256" stopOpacity="0.1" />
            <stop offset="1" stopColor="#2CC256" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="paint3_radial_262_665" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(-94 71) scale(150)">
            <stop stopColor="#2CC256" stopOpacity="0.1" />
            <stop offset="1" stopColor="#2CC256" stopOpacity="0" />
          </radialGradient>
        </defs>
      </>
    ),
    "2": (
      <>
        <rect width="300" height="300" transform="matrix(-1 8.74228e-08 8.74228e-08 1 300 0)" fill="url(#paint0_radial_262_666)" />
        <rect width="300" height="300" transform="matrix(-1 8.74228e-08 8.74228e-08 1 300 0)" fill="url(#paint1_radial_262_666)" />
        <rect width="300" height="300" transform="matrix(-1 8.74228e-08 8.74228e-08 1 300 0)" fill="url(#paint2_radial_262_666)" />
        <rect width="300" height="300" transform="matrix(-1 8.74228e-08 8.74228e-08 1 300 0)" fill="url(#paint3_radial_262_666)" />
        <rect width="300" height="300" transform="matrix(-1 8.74228e-08 8.74228e-08 1 300 0)" fill="url(#paint4_radial_262_666)" />
        <defs>
          <radialGradient id="paint0_radial_262_666" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(300 243.5) rotate(-155.81) scale(205)">
            <stop stopColor="#2CC256" stopOpacity="0.1" />
            <stop offset="1" stopColor="#2CC256" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="paint1_radial_262_666" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="rotate(38.6107) scale(273.226)">
            <stop stopColor="#2CC256" stopOpacity="0.1" />
            <stop offset="1" stopColor="#2CC256" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="paint2_radial_262_666" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(103 383) rotate(-89.3415) scale(174.011)">
            <stop stopColor="#FAC507" stopOpacity="0.1" />
            <stop offset="1" stopColor="#FAC507" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="paint3_radial_262_666" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(-50 242.5) scale(147.5)">
            <stop stopColor="#CD81F3" stopOpacity="0.07" />
            <stop offset="1" stopColor="#CD81F3" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="paint4_radial_262_666" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(425.5 62) rotate(-178.961) scale(193.032)">
            <stop stopColor="#FF6D2E" stopOpacity="0.07" />
            <stop offset="1" stopColor="#FF6D2E" stopOpacity="0" />
          </radialGradient>
        </defs>
      </>
    ),
    "3": (
      <>
        <path fill="url(#a)" d="M0 300h300V0H0v300Z" />
        <path fill="url(#b)" d="M0 300h300V0H0v300Z" />
        <path fill="url(#c)" d="M0 300h300V0H0v300Z" />
        <path fill="url(#d)" d="M0 300h300V0H0v300Z" />
        <radialGradient id="a" cx="0" cy="0" r="1" gradientTransform="matrix(0 181 -181 0 183 0)" gradientUnits="userSpaceOnUse">
          <stop stopColor="#5767C2" stopOpacity=".1" />
          <stop offset="1" stopColor="#5767C2" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="b" cx="0" cy="0" r="1" gradientTransform="translate(101 220.5) scale(142.5)" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FF6D2E" stopOpacity=".07" />
          <stop offset="1" stopColor="#FF6D2E" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="c" cx="0" cy="0" r="1" gradientTransform="matrix(208 0 0 208 -31 56.5)" gradientUnits="userSpaceOnUse">
          <stop stopColor="#2CC256" stopOpacity=".1" />
          <stop offset="1" stopColor="#2CC256" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="d" cx="0" cy="0" r="1" gradientTransform="matrix(-150 0 0 -150 394 229)" gradientUnits="userSpaceOnUse">
          <stop stopColor="#2CC256" stopOpacity=".1" />
          <stop offset="1" stopColor="#2CC256" stopOpacity="0" />
        </radialGradient>
      </>
    ),
  };

  return (
    <svg viewBox="0 0 300 300" fill="none" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none" className="pointer-events-none absolute inset-0 inline-block h-full w-full will-change-transform z-[-1]">
      {gradients[id as keyof typeof gradients]}
    </svg>
  );
}

function VerticalDivider() {
  return (
    <div className="relative z-[2] hidden h-auto min-w-[24px] w-6 bg-white dark:bg-background lg:flex">
      <div className="absolute inset-y-0 right-0 flex h-full items-center justify-center">
        <svg width="1" height="100%" fill="none" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none" className="inline-block h-full max-w-full will-change-transform">
          <line x1="0.5" y1="0" x2="0.5" y2="100%" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" strokeOpacity="0.12" strokeDasharray="4 6" vectorEffect="non-scaling-stroke" className="stroke-[color(display-p3_0.1725490196_0.1764705882_0.1882352941/1)] dark:stroke-white" />
        </svg>
      </div>
      <div className="absolute inset-y-0 left-0 flex h-full items-center justify-center">
        <svg width="1" height="100%" fill="none" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none" className="inline-block h-full max-w-full will-change-transform">
          <line x1="0.5" y1="0" x2="0.5" y2="100%" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" strokeOpacity="0.12" strokeDasharray="4 6" vectorEffect="non-scaling-stroke" className="stroke-[color(display-p3_0.1725490196_0.1764705882_0.1882352941/1)] dark:stroke-white" />
        </svg>
      </div>
    </div>
  );
}
