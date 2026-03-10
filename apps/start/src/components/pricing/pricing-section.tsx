'use client'

import {
  mainPlans,
  enterprisePlan,
  selfHostingPlan,
} from '@/lib/pricing'
import { PricingCard, type PricingPlanActionOverride } from './pricing-card'
import { DashedBorderFrame } from './pricing-decorative'

type PricingSectionProps = {
  heading?: string
  summary?: string
  locale?: string
  resolvePlanAction?: (planName: string) => PricingPlanActionOverride | undefined
}


export function PricingSection({
  heading = 'Simple, Transparent Plans',
  summary = 'Choose the plan that best fits your needs. No hidden costs.',
  locale = 'en',
  resolvePlanAction,
}: PricingSectionProps) {
  return (
    <>
      <style>{`
        /**
         * Keeps the pricing-card hover treatment scoped to this section.
         * The gradients start intentionally subtle, then gain opacity, blur,
         * and a slow orbital drift on hover to make the background feel alive.
         */
        @keyframes pricing-card-orb-drift {
          0% {
            transform: translate3d(0, 0, 0) scale(1.08) rotate(0deg);
          }
          25% {
            transform: translate3d(4%, -3%, 0) scale(1.14) rotate(6deg);
          }
          50% {
            transform: translate3d(-3%, 4%, 0) scale(1.18) rotate(-4deg);
          }
          75% {
            transform: translate3d(3%, 2%, 0) scale(1.15) rotate(3deg);
          }
          100% {
            transform: translate3d(0, 0, 0) scale(1.08) rotate(0deg);
          }
        }

        .pricing-card__orb {
          opacity: 0.56;
          filter: saturate(1.08) brightness(0.97) blur(0px);
          mix-blend-mode: multiply;
          transform: scale(1);
          transform-origin: center;
          transition:
            opacity 320ms ease,
            filter 420ms ease,
            transform 420ms ease;
        }

        .pricing-card:hover .pricing-card__orb,
        .pricing-card:focus-within .pricing-card__orb {
          opacity: 0.9;
          filter: saturate(1.48) brightness(0.94) contrast(1.08) blur(9px);
          transform: scale(1.07);
          animation: pricing-card-orb-drift 7s ease-in-out infinite;
        }

        .dark .pricing-card__orb {
          opacity: 0.42;
          filter: saturate(1.05) blur(0px);
          mix-blend-mode: screen;
        }

        .dark .pricing-card:hover .pricing-card__orb,
        .dark .pricing-card:focus-within .pricing-card__orb {
          opacity: 1;
          filter: saturate(1.45) brightness(1.18) blur(10px);
        }
      `}</style>

      <section
        className="flex w-full flex-col items-center"
        id="pricing"
        aria-labelledby="pricing-heading"
        aria-describedby="pricing-summary"
      >
        <div className="mb-8 flex flex-col items-center justify-center space-y-4 px-4 text-center">
          <h2
            id="pricing-heading"
            className="text-3xl font-bold tracking-tighter text-content-emphasis sm:text-4xl"
          >
            {heading}
          </h2>
          <p
            id="pricing-summary"
            className="max-w-[700px] text-content-muted md:text-xl/relaxed"
          >
            {summary}
          </p>
        </div>

        <div className="relative mx-auto w-full max-w-[1400px] max-md:px-4 max-md:py-4 max-lg:p-4 lg:p-12">
          <DashedBorderFrame>
            <div className="relative flex w-full items-stretch justify-center gap-8 overflow-hidden max-lg:flex-col max-lg:gap-6 lg:gap-6">
              {mainPlans.map((plan) => (
                <PricingCard
                  key={plan.name}
                  plan={plan}
                  locale={locale}
                  actionOverride={resolvePlanAction?.(plan.name)}
                />
              ))}
            </div>
          </DashedBorderFrame>
        </div>

        {/* Enterprise & Self-hosting - same parent border structure, hugs the cards */}
        <div className="relative mx-auto mt-12 w-fit max-md:px-4 max-md:py-4 max-lg:p-4 lg:p-12">
          <DashedBorderFrame>
            <div className="relative flex w-full items-stretch justify-center gap-8 overflow-hidden max-lg:flex-col max-lg:gap-6 lg:gap-6">
              <PricingCard
                plan={enterprisePlan}
                locale={locale}
                fixedWidth
                actionOverride={resolvePlanAction?.(enterprisePlan.name)}
              />
              <PricingCard
                plan={selfHostingPlan}
                locale={locale}
                fixedWidth
                actionOverride={resolvePlanAction?.(selfHostingPlan.name)}
              />
            </div>
          </DashedBorderFrame>
        </div>
      </section>
    </>
  )
}
