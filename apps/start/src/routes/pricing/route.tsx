import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { PricingPageLayout } from '@/components/pricing/pricing-page-layout'
import { PricingPage } from '@/components/pricing/pricing-page'
import { buildPageMetadata } from '@/lib/frontend/metadata/metadata.functions'
import { isSelfHosted } from '@/utils/app-feature-flags'
import { m } from '@/paraglide/messages.js'

/**
 * Pricing page route. Renders outside the dashboard layout at /pricing.
 */
export const Route = createFileRoute('/pricing')({
  validateSearch: z.object({
    checkoutPlan: z.enum(['plus', 'pro', 'scale']).optional(),
    checkoutSeats: z.coerce.number().int().min(1).max(500).optional(),
    resumeCheckout: z.literal('1').optional(),
  }),
  head: () => ({
    meta: buildPageMetadata({
      title: 'Pricing',
      description:
        'Compare Rift plans and pricing to chat with top AI models in one workspace.',
    }),
  }),
  component: PricingRouteComponent,
})

function PricingRouteComponent() {
  const search = Route.useSearch()

  return (
    <PricingPageLayout>
      {!isSelfHosted ? (
        <PricingPage checkoutIntent={search} />
      ) : (
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 rounded-3xl border border-border-base bg-surface-raised/70 px-6 py-10">
          <h1 className="text-3xl font-semibold text-foreground-strong">
            {m.pricing_self_hosted_title()}
          </h1>
          <p className="text-base text-foreground-secondary">
            {m.pricing_self_hosted_description()}
          </p>
        </div>
      )}
    </PricingPageLayout>
  )
}
